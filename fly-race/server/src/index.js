import express from 'express';
import cors from 'cors';
import {
  BET_AMOUNT_USDC,
  ENTRIES_PER_ROUND,
  FLY_COLORS,
  FLY_COUNT,
  FLY_NAMES,
  MAX_BETS_PER_WALLET,
  PAYOUT_USDC,
  RAKE_USDC,
} from '../../shared/constants.js';
import { config } from './config.js';
import { Store } from './store.js';
import { SolanaService } from './solana.js';
import { BetError, RoundManager, publicRound } from './rounds.js';

const store = new Store(config.dataFile);
const solana = new SolanaService();
const rounds = new RoundManager(store, solana);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, cluster: config.cluster, demoMode: config.demoMode }));

app.get('/api/config', (req, res) => {
  res.json({
    cluster: config.cluster,
    demoMode: config.demoMode,
    usdcMint: config.usdcMint,
    escrowWallet: solana.escrowAddress,
    betAmountUsdc: BET_AMOUNT_USDC,
    payoutUsdc: PAYOUT_USDC,
    rakeUsdcPerRound: RAKE_USDC,
    entriesPerRound: ENTRIES_PER_ROUND,
    maxBetsPerWallet: MAX_BETS_PER_WALLET,
    brainKind: config.brainKind,
    flies: Array.from({ length: FLY_COUNT }, (_, i) => ({
      index: i,
      name: FLY_NAMES[i],
      color: FLY_COLORS[i],
    })),
  });
});

// Keep a finished round on screen briefly so players actually see who won
// before the lobby flips to the next one.
const RESULT_HOLD_MS = 20_000;

app.get('/api/state', (req, res) => {
  const active = store.activeRounds()[0];
  const last = store.rounds[store.rounds.length - 1];
  const finishedAt = last && (last.settledAt || last.refundedAt);
  const holding = !active && finishedAt && Date.now() - finishedAt < RESULT_HOLD_MS;
  const current = active || (holding ? last : rounds.ensureOpenRound());
  const history = store.rounds
    .filter((r) => r.status === 'settled' || r.status === 'refunded')
    .slice(-10)
    .reverse()
    .map((r) => publicRound(r));
  res.json({ round: publicRound(current), history, serverTime: Date.now() });
});

app.get('/api/rounds/:id', (req, res) => {
  const round = store.roundById(Number(req.params.id));
  if (!round) return res.status(404).json({ error: 'round_not_found' });
  res.json(publicRound(round));
});

app.post('/api/bets', async (req, res) => {
  try {
    const { wallet, flyIndex, signature } = req.body || {};
    const result = await rounds.placeBet({ wallet, flyIndex: Number(flyIndex), signature });
    res.json(result);
  } catch (err) {
    if (err instanceof BetError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('bet failed', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// Convenience for demo mode only: fabricates a paid bet so the loop can be
// exercised without any wallet. Disabled whenever real money is involved.
app.post('/api/dev/fake-bet', async (req, res) => {
  if (!config.demoMode) return res.status(403).json({ error: 'demo_mode_only' });
  const { wallet, flyIndex } = req.body || {};
  try {
    const result = await rounds.placeBet({
      wallet: wallet || `Demo${Math.random().toString(36).slice(2).padEnd(38, 'x').slice(0, 40)}`,
      flyIndex: Number(flyIndex),
      signature: `demo-sig-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || 'internal_error', message: err.message });
  }
});

const TICK_MS = 2000;
setInterval(() => {
  rounds.tick().catch((err) => console.error('tick error', err));
}, TICK_MS);

app.listen(config.port, () => {
  console.log(`Fly Race server on :${config.port}`);
  console.log(`  cluster:   ${config.cluster}`);
  console.log(`  demo mode: ${config.demoMode ? 'ON (no real USDC moves)' : 'OFF (real transfers)'}`);
  console.log(`  escrow:    ${solana.escrowAddress || '(none — demo mode)'}`);
});
