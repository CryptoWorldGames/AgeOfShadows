// Shared game + economy constants. Imported by both the server and the client so
// the two can never disagree about the rules of a round.

export const FLY_COUNT = 5;

// World is a fixed logical space; the canvas scales to it.
export const WORLD = {
  width: 1000,
  height: 600,
};

export const FOOD = {
  x: 940,
  y: 300,
  radius: 22,
};

export const FLY_RADIUS = 7;

// Simulation runs on a fixed timestep so a race is bit-for-bit reproducible
// from its seed on any machine.
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
export const MAX_RACE_TICKS = TICK_HZ * 90; // 90s hard cap

export const FLY_NAMES = ['Buzz', 'Nyx', 'Zip', 'Mothra', 'Gnat'];
export const FLY_COLORS = ['#ff5d5d', '#4dd2ff', '#ffd24d', '#9d7bff', '#57e08a'];

// Economy (USDC, 6 decimals on Solana).
export const USDC_DECIMALS = 6;
export const BET_AMOUNT_USDC = 0.25;
export const PAYOUT_USDC = 1.0;
export const ENTRIES_PER_ROUND = FLY_COUNT; // one slot per fly
export const MAX_BETS_PER_WALLET = 3;
// Pot = 5 * 0.25 = 1.25, winner takes 1.00, so the house keeps 0.25 per round.
export const RAKE_USDC = BET_AMOUNT_USDC * ENTRIES_PER_ROUND - PAYOUT_USDC;

export const REFUND_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h from the first bet
export const COUNTDOWN_MS = 10_000; // delay between the 5th bet and the start gun

export const toBaseUnits = (usdc) => Math.round(usdc * 10 ** USDC_DECIMALS);
export const fromBaseUnits = (units) => Number(units) / 10 ** USDC_DECIMALS;
