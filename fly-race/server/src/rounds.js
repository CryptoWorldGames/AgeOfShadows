import { randomUUID } from 'node:crypto';
import {
  BET_AMOUNT_USDC,
  COUNTDOWN_MS,
  ENTRIES_PER_ROUND,
  FLY_COUNT,
  MAX_BETS_PER_WALLET,
  PAYOUT_USDC,
  RAKE_USDC,
  REFUND_TIMEOUT_MS,
} from '../../shared/constants.js';
import { hashStringToSeed } from '../../shared/prng.js';
import { runRace } from '../../shared/sim.js';
import { config } from './config.js';

const REFUND_TIMEOUT = config.refundTimeoutMsOverride ?? REFUND_TIMEOUT_MS;
const COUNTDOWN = config.countdownMsOverride ?? COUNTDOWN_MS;
const MAX_TRANSFER_ATTEMPTS = 5;

export class BetError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class RoundManager {
  constructor(store, solana, { log = console } = {}) {
    this.store = store;
    this.solana = solana;
    this.log = log;
    // Bets are serialized: two people racing for the last slot on a fly must
    // not both pass the "is this fly free" check.
    this.queue = Promise.resolve();
  }

  ensureOpenRound() {
    let round = this.store.openRound();
    if (!round) {
      round = this.store.createRound({
        status: 'open',
        createdAt: Date.now(),
        firstBetAt: null,
        refundDeadline: null,
        bets: [],
        brainKind: config.brainKind,
        seed: null,
        winnerFly: null,
        startAt: null,
        endsAt: null,
        raceTicks: null,
        raceDurationMs: null,
        payout: null,
        refunds: null,
      });
    }
    return round;
  }

  placeBet(input) {
    // Chain onto the queue so bet handling is strictly sequential.
    const run = this.queue.then(() => this.#placeBetUnsafe(input));
    this.queue = run.catch(() => {});
    return run;
  }

  async #placeBetUnsafe({ wallet, flyIndex, signature }) {
    if (typeof wallet !== 'string' || wallet.length < 32 || wallet.length > 44) {
      throw new BetError('bad_wallet', 'wallet must be a base58 Solana address');
    }
    if (!Number.isInteger(flyIndex) || flyIndex < 0 || flyIndex >= FLY_COUNT) {
      throw new BetError('bad_fly', `flyIndex must be an integer 0..${FLY_COUNT - 1}`);
    }
    if (typeof signature !== 'string' || signature.length < 16) {
      throw new BetError('bad_signature', 'signature (USDC transfer tx) is required');
    }
    if (this.store.isSignatureUsed(signature)) {
      throw new BetError('signature_used', 'that transaction has already funded a bet', 409);
    }

    const round = this.ensureOpenRound();
    if (round.bets.some((b) => b.flyIndex === flyIndex)) {
      throw new BetError('fly_taken', 'that fly is already taken for this round', 409);
    }
    const mine = round.bets.filter((b) => b.wallet === wallet);
    if (mine.length >= MAX_BETS_PER_WALLET) {
      throw new BetError(
        'wallet_limit',
        `a wallet may back at most ${MAX_BETS_PER_WALLET} flies per round`,
        409
      );
    }

    const verification = await this.solana.verifyBetTransfer({
      signature,
      senderWallet: wallet,
      amountUsdc: BET_AMOUNT_USDC,
    });
    if (!verification.ok) {
      throw new BetError('payment_unverified', `USDC transfer not verified: ${verification.reason}`, 402);
    }

    const bet = {
      id: randomUUID(),
      wallet,
      flyIndex,
      amountUsdc: BET_AMOUNT_USDC,
      signature,
      createdAt: Date.now(),
      verification,
    };
    round.bets.push(bet);
    this.store.markSignature(signature, bet.id);

    if (round.bets.length === 1) {
      round.firstBetAt = bet.createdAt;
      round.refundDeadline = bet.createdAt + REFUND_TIMEOUT;
    }
    if (round.bets.length >= ENTRIES_PER_ROUND) this.#lockRound(round);
    this.store.save();
    return { bet, round: publicRound(round) };
  }

  /**
   * All five slots are sold: freeze the round and settle the outcome now.
   *
   * The seed is derived from the five bet signatures, which are all on chain
   * before the seed exists — so the house cannot pick a seed that favours a
   * fly, and anyone can recompute the winner from the published seed.
   */
  #lockRound(round) {
    const seedInput = round.bets
      .map((b) => b.signature)
      .sort()
      .join('|');
    round.seed = hashStringToSeed(seedInput);
    round.seedInput = seedInput;
    const result = runRace(round.seed, round.brainKind);
    round.winnerFly = result.winner;
    round.raceTicks = result.ticks;
    round.raceDurationMs = result.durationMs;
    round.finishOrder = result.finishOrder;
    round.status = 'locked';
    round.lockedAt = Date.now();
    round.startAt = round.lockedAt + COUNTDOWN;
    round.endsAt = round.startAt + result.durationMs;

    const winningBet = round.bets.find((b) => b.flyIndex === result.winner);
    round.payout = {
      status: 'pending',
      wallet: winningBet.wallet,
      betId: winningBet.id,
      amountUsdc: PAYOUT_USDC,
      rakeUsdc: RAKE_USDC,
      attempts: 0,
      signature: null,
      error: null,
    };
    this.log.info?.(`[round ${round.id}] locked, winner = fly ${result.winner} (${result.durationMs}ms)`);
  }

  /** Periodic housekeeping: start races, pay winners, refund stale rounds. */
  async tick(now = Date.now()) {
    const handled = new Set();
    for (const round of this.store.activeRounds()) {
      handled.add(round.id);
      try {
        if (round.status === 'open' && round.refundDeadline && now >= round.refundDeadline) {
          await this.#refundRound(round, 'timeout');
          continue;
        }
        // Sequential, not exclusive: a tick that arrives after a long outage
        // must be able to start *and* settle the same round in one pass.
        if (round.status === 'locked' && now >= round.startAt) {
          round.status = 'racing';
          this.store.save();
        }
        if (round.status === 'racing' && now >= round.endsAt) {
          await this.#settleRound(round);
        }
      } catch (err) {
        this.log.error?.(`[round ${round.id}] tick failed: ${err.message}`);
      }
    }
    // Retry any transfer that did not go through the first time.
    for (const round of this.store.rounds) {
      if (round.status === 'settled' && round.payout?.status === 'failed') {
        await this.#sendPayout(round);
      }
      if (round.status === 'refunding' && !handled.has(round.id)) {
        await this.#refundRound(round, round.refundReason || 'timeout');
      }
    }
  }

  async #settleRound(round) {
    round.status = 'settled';
    round.settledAt = Date.now();
    this.store.save();
    await this.#sendPayout(round);
  }

  async #sendPayout(round) {
    const payout = round.payout;
    if (!payout || payout.status === 'sent') return;
    if (payout.attempts >= MAX_TRANSFER_ATTEMPTS) {
      payout.status = 'manual_review';
      this.store.save();
      return;
    }
    payout.attempts += 1;
    try {
      const { signature } = await this.solana.sendUsdc({
        toWallet: payout.wallet,
        amountUsdc: payout.amountUsdc,
      });
      payout.status = 'sent';
      payout.signature = signature;
      payout.error = null;
      this.log.info?.(`[round ${round.id}] paid ${payout.amountUsdc} USDC to ${payout.wallet} (${signature})`);
    } catch (err) {
      payout.status = 'failed';
      payout.error = err.message;
      this.log.error?.(`[round ${round.id}] payout failed: ${err.message}`);
    }
    this.store.save();
  }

  /** Returns every bettor their stake, to the wallet they paid from. */
  async #refundRound(round, reason) {
    round.status = 'refunding';
    round.refundReason = reason;
    round.refunds = round.refunds || {};
    this.store.save();

    let allDone = true;
    for (const bet of round.bets) {
      const rec = (round.refunds[bet.id] = round.refunds[bet.id] || {
        wallet: bet.wallet,
        amountUsdc: bet.amountUsdc,
        status: 'pending',
        attempts: 0,
        signature: null,
        error: null,
      });
      if (rec.status === 'sent' || rec.status === 'manual_review') continue;
      if (rec.attempts >= MAX_TRANSFER_ATTEMPTS) {
        rec.status = 'manual_review';
        allDone = false;
        continue;
      }
      rec.attempts += 1;
      try {
        const { signature } = await this.solana.sendUsdc({
          toWallet: bet.wallet,
          amountUsdc: bet.amountUsdc,
        });
        rec.status = 'sent';
        rec.signature = signature;
      } catch (err) {
        rec.status = 'failed';
        rec.error = err.message;
        allDone = false;
      }
      this.store.save();
    }

    if (allDone) {
      round.status = 'refunded';
      round.refundedAt = Date.now();
      this.log.info?.(`[round ${round.id}] refunded ${round.bets.length} bet(s) (${reason})`);
    }
    this.store.save();
  }
}

/** Strips anything a player should not see yet (or at all). */
export function publicRound(round, now = Date.now()) {
  if (!round) return null;
  const raceOver = round.endsAt ? now >= round.endsAt : false;
  return {
    id: round.id,
    status: round.status,
    createdAt: round.createdAt,
    firstBetAt: round.firstBetAt,
    refundDeadline: round.refundDeadline,
    entriesFilled: round.bets.length,
    entriesNeeded: ENTRIES_PER_ROUND,
    slots: Array.from({ length: FLY_COUNT }, (_, i) => {
      const bet = round.bets.find((b) => b.flyIndex === i);
      return bet
        ? { flyIndex: i, taken: true, wallet: bet.wallet, at: bet.createdAt, signature: bet.signature }
        : { flyIndex: i, taken: false };
    }),
    seed: round.seed,
    brainKind: round.brainKind,
    startAt: round.startAt,
    endsAt: round.endsAt,
    raceDurationMs: round.raceDurationMs,
    // Held back until the animation has actually finished.
    winnerFly: raceOver ? round.winnerFly : null,
    payout: raceOver && round.payout
      ? { status: round.payout.status, wallet: round.payout.wallet, amountUsdc: round.payout.amountUsdc, signature: round.payout.signature }
      : null,
    refunds: round.refunds || null,
    refundReason: round.refundReason || null,
  };
}
