import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { RoundManager, publicRound } from '../src/rounds.js';
import { BET_AMOUNT_USDC, PAYOUT_USDC, RAKE_USDC } from '../../shared/constants.js';

const WALLETS = [
  'FLyRaceTestWa11et00000000000000000000000001',
  'FLyRaceTestWa11et00000000000000000000000002',
  'FLyRaceTestWa11et00000000000000000000000003',
];

function makeManager() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'flyrace-')), 'db.json');
  const store = new Store(file);
  const transfers = [];
  const solana = {
    verifyBetTransfer: async () => ({ ok: true, demo: true }),
    sendUsdc: async ({ toWallet, amountUsdc }) => {
      transfers.push({ toWallet, amountUsdc });
      return { signature: `sig-${transfers.length}` };
    },
  };
  const quiet = { info: () => {}, error: () => {} };
  return { store, transfers, manager: new RoundManager(store, solana, { log: quiet }) };
}

// Real Solana signatures are ~88 base58 chars; keep test ones realistic.
const sig = (label) => `${label}`.padEnd(88, 'S');

const bet = (manager, wallet, flyIndex) =>
  manager.placeBet({ wallet, flyIndex, signature: sig(`${wallet}-${flyIndex}`) });

test('economics: 5 entries fund one payout plus the rake', () => {
  assert.equal(BET_AMOUNT_USDC * 5, 1.25);
  assert.equal(PAYOUT_USDC, 1);
  assert.equal(RAKE_USDC, 0.25);
});

test('a fly can only be backed once per round', async () => {
  const { manager } = makeManager();
  await bet(manager, WALLETS[0], 2);
  await assert.rejects(() => bet(manager, WALLETS[1], 2), /already taken/);
});

test('a wallet may back at most 3 flies', async () => {
  const { manager } = makeManager();
  await bet(manager, WALLETS[0], 0);
  await bet(manager, WALLETS[0], 1);
  await bet(manager, WALLETS[0], 2);
  await assert.rejects(() => bet(manager, WALLETS[0], 3), /at most 3/);
});

test('the same tx signature cannot fund two bets', async () => {
  const { manager } = makeManager();
  await manager.placeBet({ wallet: WALLETS[0], flyIndex: 0, signature: sig('dup') });
  await assert.rejects(
    () => manager.placeBet({ wallet: WALLETS[1], flyIndex: 1, signature: sig('dup') }),
    /already funded/
  );
});

test('the 5th bet locks the round and the winner is paid after the race', async () => {
  const { manager, store, transfers } = makeManager();
  for (let i = 0; i < 5; i++) await bet(manager, WALLETS[i % 3], i);

  const round = store.rounds[0];
  assert.equal(round.status, 'locked');
  assert.ok(round.seed !== null);
  assert.ok(round.winnerFly >= 0 && round.winnerFly < 5);
  // The winner is not revealed to clients until the animation ends.
  assert.equal(publicRound(round, round.startAt).winnerFly, null);

  await manager.tick(round.startAt + 1);
  assert.equal(store.rounds[0].status, 'racing');

  await manager.tick(round.endsAt + 1);
  assert.equal(store.rounds[0].status, 'settled');
  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].amountUsdc, PAYOUT_USDC);
  assert.equal(transfers[0].toWallet, round.bets.find((b) => b.flyIndex === round.winnerFly).wallet);
  assert.equal(publicRound(store.rounds[0], round.endsAt + 1).winnerFly, round.winnerFly);
});

test('an unfilled round refunds every bettor after the deadline', async () => {
  const { manager, store, transfers } = makeManager();
  await bet(manager, WALLETS[0], 0);
  await bet(manager, WALLETS[1], 1);

  const round = store.rounds[0];
  await manager.tick(round.refundDeadline - 1);
  assert.equal(store.rounds[0].status, 'open');
  assert.equal(transfers.length, 0);

  await manager.tick(round.refundDeadline + 1);
  assert.equal(store.rounds[0].status, 'refunded');
  assert.equal(transfers.length, 2);
  assert.deepEqual(
    transfers.map((t) => t.toWallet).sort(),
    [WALLETS[0], WALLETS[1]].sort()
  );
  assert.ok(transfers.every((t) => t.amountUsdc === BET_AMOUNT_USDC));
});

test('a failed transfer is retried on the next tick', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'flyrace-')), 'db.json');
  const store = new Store(file);
  let fail = true;
  const solana = {
    verifyBetTransfer: async () => ({ ok: true }),
    sendUsdc: async () => {
      if (fail) throw new Error('rpc down');
      return { signature: 'ok' };
    },
  };
  const manager = new RoundManager(store, solana, { log: { info: () => {}, error: () => {} } });
  for (let i = 0; i < 5; i++) await manager.placeBet({ wallet: WALLETS[i % 3], flyIndex: i, signature: sig(`s${i}`) });
  const round = store.rounds[0];
  await manager.tick(round.endsAt + 1);
  assert.equal(round.payout.status, 'failed');
  fail = false;
  await manager.tick(round.endsAt + 2);
  assert.equal(round.payout.status, 'sent');
  assert.equal(round.payout.signature, 'ok');
});

test('an unverified payment is rejected', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'flyrace-')), 'db.json');
  const store = new Store(file);
  const solana = {
    verifyBetTransfer: async () => ({ ok: false, reason: 'escrow_amount_mismatch' }),
    sendUsdc: async () => ({ signature: 'x' }),
  };
  const manager = new RoundManager(store, solana, { log: { info: () => {}, error: () => {} } });
  await assert.rejects(
    () => manager.placeBet({ wallet: WALLETS[0], flyIndex: 0, signature: sig('nope') }),
    /escrow_amount_mismatch/
  );
  assert.equal(store.rounds[0].bets.length, 0);
});
