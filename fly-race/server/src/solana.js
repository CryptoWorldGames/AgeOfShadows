import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  transferChecked,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { USDC_DECIMALS, toBaseUnits } from '../../shared/constants.js';
import { config } from './config.js';

const MAX_TX_AGE_MS = 24 * 60 * 60 * 1000;

function loadEscrowKeypair(secret) {
  if (!secret) return null;
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

export class SolanaService {
  constructor() {
    this.demoMode = config.demoMode;
    this.mint = new PublicKey(config.usdcMint);
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.escrow = loadEscrowKeypair(config.escrowSecretKey);
    if (!this.escrow && !this.demoMode) {
      throw new Error('ESCROW_SECRET_KEY is required when DEMO_MODE=false');
    }
  }

  get escrowAddress() {
    return this.escrow ? this.escrow.publicKey.toBase58() : null;
  }

  /**
   * Confirms that `signature` is a settled USDC transfer of exactly `amountUsdc`
   * from `senderWallet` into the escrow wallet.
   *
   * Works off pre/post token balances rather than instruction decoding, so it
   * accepts any transfer shape (legacy, versioned, CPI, token-2022 wrappers)
   * while still proving the exact net movement of funds.
   */
  async verifyBetTransfer({ signature, senderWallet, amountUsdc }) {
    if (this.demoMode) {
      return { ok: true, demo: true };
    }
    const tx = await this.connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) return { ok: false, reason: 'transaction_not_found' };
    if (tx.meta?.err) return { ok: false, reason: 'transaction_failed' };
    if (tx.blockTime && Date.now() - tx.blockTime * 1000 > MAX_TX_AGE_MS) {
      return { ok: false, reason: 'transaction_too_old' };
    }

    const mint = this.mint.toBase58();
    const escrowOwner = this.escrow.publicKey.toBase58();
    const expected = toBaseUnits(amountUsdc);

    const pre = tx.meta?.preTokenBalances || [];
    const post = tx.meta?.postTokenBalances || [];
    const deltas = new Map(); // owner -> net base units of our mint

    const add = (entries, sign) => {
      for (const b of entries) {
        if (b.mint !== mint) continue;
        const owner = b.owner;
        if (!owner) continue;
        const amt = BigInt(b.uiTokenAmount.amount) * BigInt(sign);
        deltas.set(owner, (deltas.get(owner) ?? 0n) + amt);
      }
    };
    add(post, 1);
    add(pre, -1);

    const escrowDelta = deltas.get(escrowOwner) ?? 0n;
    if (escrowDelta !== BigInt(expected)) {
      return { ok: false, reason: 'escrow_amount_mismatch', got: escrowDelta.toString() };
    }
    const senderDelta = deltas.get(senderWallet) ?? 0n;
    if (senderDelta !== -BigInt(expected)) {
      return { ok: false, reason: 'sender_did_not_pay', got: senderDelta.toString() };
    }
    return { ok: true, slot: tx.slot, blockTime: tx.blockTime };
  }

  /** Sends USDC from escrow to an arbitrary wallet owner. */
  async sendUsdc({ toWallet, amountUsdc }) {
    if (this.demoMode) {
      return { signature: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, demo: true };
    }
    const destination = new PublicKey(toWallet);
    const fromAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.escrow,
      this.mint,
      this.escrow.publicKey
    );
    const toAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.escrow,
      this.mint,
      destination
    );
    const signature = await transferChecked(
      this.connection,
      this.escrow,
      fromAta.address,
      this.mint,
      toAta.address,
      this.escrow,
      toBaseUnits(amountUsdc),
      USDC_DECIMALS
    );
    return { signature };
  }

  async escrowBalances() {
    if (this.demoMode || !this.escrow) return { demo: true };
    const sol = await this.connection.getBalance(this.escrow.publicKey);
    let usdc = 0;
    try {
      const ata = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.escrow,
        this.mint,
        this.escrow.publicKey
      );
      const bal = await this.connection.getTokenAccountBalance(ata.address);
      usdc = Number(bal.value.uiAmount || 0);
    } catch {
      usdc = 0;
    }
    return { sol: sol / 1e9, usdc };
  }
}
