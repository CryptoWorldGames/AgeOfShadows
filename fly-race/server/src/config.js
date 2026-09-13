import 'dotenv/config';
import { clusterApiUrl } from '@solana/web3.js';

const bool = (v, dflt) => (v === undefined ? dflt : /^(1|true|yes)$/i.test(String(v)));

export const CLUSTER = (process.env.SOLANA_CLUSTER || 'devnet').toLowerCase();

// Real-money guard. Mainnet is refused unless someone deliberately sets
// ALLOW_MAINNET=true; v1 is devnet-only by design.
if (CLUSTER === 'mainnet-beta' && !bool(process.env.ALLOW_MAINNET, false)) {
  throw new Error(
    'Refusing to start on mainnet-beta. This build is devnet-only. ' +
      'Set ALLOW_MAINNET=true only after a deliberate review of escrow key handling.'
  );
}

// Known USDC mints. Devnet is Circle\'s USDC-Dev faucet mint.
const DEFAULT_MINTS = {
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export const config = {
  port: Number(process.env.PORT || 4000),
  cluster: CLUSTER,
  rpcUrl: process.env.SOLANA_RPC_URL || clusterApiUrl(CLUSTER === 'mainnet-beta' ? 'mainnet-beta' : 'devnet'),
  usdcMint: process.env.USDC_MINT || DEFAULT_MINTS[CLUSTER] || DEFAULT_MINTS.devnet,
  escrowSecretKey: process.env.ESCROW_SECRET_KEY || '',
  // DEMO_MODE skips on-chain verification and payouts so the full game loop
  // (bet -> 5 entries -> race -> settle -> refund) can be tested with no funds.
  demoMode: bool(process.env.DEMO_MODE, true),
  brainKind: process.env.BRAIN_KIND || 'randomWalk',
  dataFile: process.env.DATA_FILE || 'data/flyrace.json',
  // Shortened timers for local testing, e.g. REFUND_TIMEOUT_MS=60000.
  refundTimeoutMsOverride: process.env.REFUND_TIMEOUT_MS ? Number(process.env.REFUND_TIMEOUT_MS) : null,
  countdownMsOverride: process.env.COUNTDOWN_MS ? Number(process.env.COUNTDOWN_MS) : null,
};
