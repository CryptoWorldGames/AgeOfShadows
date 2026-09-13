# 🪰 Fly Race

Five simulated flies race across a canvas to one piece of food. Players wager
0.25 USDC on Solana; the fly that reaches the food first pays its backer 1.00 USDC.

**Status: devnet / demo only.** Nothing here touches mainnet — the server
refuses to start on `mainnet-beta` unless `ALLOW_MAINNET=true` is set on purpose.

## Layout

```
fly-race/
  shared/      simulation + rules shared verbatim by server and browser
    sim.js         deterministic race (fixed timestep, seeded)
    prng.js        mulberry32 + seed derivation
    constants.js   world, economy, timers
    brains/
      randomWalk.js  placeholder movement (current default)
      lif.js         leaky integrate-and-fire spiking net, awaiting real connectome
  server/      Express + @solana/web3.js escrow, bet ledger, payouts, refunds
  client/      React + Canvas front end (Vite)
```

## Rules

| | |
|---|---|
| Bet | 0.25 USDC per fly |
| Winner payout | 1.00 USDC |
| Entries per round | 5 — one slot per fly, first come first served |
| Max per wallet | 3 different flies (never twice on the same fly) |
| House rake | 0.25 USDC **per round** (5 × 0.25 = 1.25 in, 1.00 out) |
| Unfilled round | all bettors auto-refunded 24h after the *first* bet |

> Note on the rake: the brief said "0.25 rake per bet", but with a 1.25 pot and a
> 1.00 payout the house keeps 0.25 **per round**, not per bet. The code implements
> that arithmetic. Charging 0.25 rake per bet would mean a 1.25 payout is impossible
> without changing the bet size or payout.

## Fairness

A round's race seed is derived (FNV-1a) from the five bet transaction signatures,
sorted. Every signature is on chain before the seed can exist, so the house cannot
pick a seed that favours a fly, and anyone can recompute the winner:

```js
import { hashStringToSeed } from './shared/prng.js';
import { runRace } from './shared/sim.js';
runRace(hashStringToSeed(sortedSignatures.join('|'))).winner;
```

The server decides the winner the moment the 5th bet lands. The browser only
replays that seed — a tampered client cannot change a payout.

## Run it (Windows `cmd`)

Two terminals.

**1. Server**

```
cd fly-race\server
npm install
copy .env.example .env
npm start
```

**2. Client**

```
cd fly-race\client
npm install
npm run dev
```

Open http://localhost:5173.

With the default `DEMO_MODE=true` no chain calls are made: press
**Place demo bet** five times and the full loop runs — lock, countdown, race,
winner, (fake) payout.

Tests: `cd fly-race\server && npm test`

### Faster timers while testing

```
cd fly-race\server
set COUNTDOWN_MS=3000 && set REFUND_TIMEOUT_MS=60000 && npm start
```

That makes the 24h refund window one minute, so the refund path is testable in a sitting.

## Switching to real devnet USDC

1. `cd fly-race\server && node scripts/gen-escrow.js` — prints an escrow address
   and its secret key.
2. Put the secret key in `server\.env` as `ESCROW_SECRET_KEY`, and set `DEMO_MODE=false`.
3. Fund the escrow with devnet SOL (for fees + token account rent):
   `solana airdrop 2 <ESCROW_ADDRESS> --url devnet`
4. Fund it with devnet USDC from https://faucet.circle.com so it can pay winners.
5. Restart. The UI now shows the escrow address: players send exactly 0.25 USDC,
   then paste the transaction signature to claim their fly.

The server verifies each claimed transfer against pre/post token balances on the
confirmed transaction — it checks the escrow received **exactly** 0.25 USDC of the
configured mint, that the claiming wallet is the one that paid, that the tx is not
older than 24h, and that the signature has never funded another bet.

## API

| | |
|---|---|
| `GET /api/config` | cluster, escrow address, prices, fly list |
| `GET /api/state` | current round, slots, timers, recent results |
| `GET /api/rounds/:id` | one round |
| `POST /api/bets` | `{ wallet, flyIndex, signature }` → verifies payment, claims the fly |
| `POST /api/dev/fake-bet` | demo mode only; fabricates a paid bet |

## Swapping in real connectome data

`shared/brains/lif.js` already runs a leaky integrate-and-fire network; only the
connectome is placeholder. Convert a FlyWire / MaleCNS subset to:

```js
{
  neurons:  [{ id, type: 'exc' | 'inh' }, ...],
  synapses: [{ pre, post, weight }, ...],
  inputs:   { bearingLeft, bearingRight, proximity },  // neuron ids
  outputs:  { turnLeft, turnRight, thrust },
}
```

then pass it as the second argument to `createLIFBrain(seed, connectome)` and set
`BRAIN_KIND=lif`. Movement stays deterministic per seed, so payouts stay verifiable.

## Not done yet (deliberately)

- Mainnet. Ask before any of it.
- Wallet-adapter integration — players currently paste a tx signature by hand.
- Escrow key lives in an env var; a real-money deployment wants a KMS/HSM or at
  minimum a separate hot wallet with a swept balance.
- The ledger is a JSON file. Fine for devnet, replace with Postgres before volume.
