import {
  DT,
  FLY_COUNT,
  FLY_RADIUS,
  FOOD,
  MAX_RACE_TICKS,
  WORLD,
} from './constants.js';
import { flySeed, mulberry32 } from './prng.js';
import { createRandomWalkBrain } from './brains/randomWalk.js';
import { createLIFBrain } from './brains/lif.js';

const MAX_SPEED = 210; // world units / s
const MAX_TURN_RATE = 7; // rad / s
const START_X = 60;

export const BRAINS = {
  randomWalk: createRandomWalkBrain,
  lif: createLIFBrain,
};

function makeFly(index, seed, brainKind) {
  const rand = mulberry32(seed ^ 0x5bf03635);
  const factory = BRAINS[brainKind] ?? BRAINS.randomWalk;
  const laneHeight = WORLD.height / FLY_COUNT;
  return {
    index,
    seed,
    x: START_X + rand() * 20,
    y: laneHeight * (index + 0.5) + (rand() - 0.5) * laneHeight * 0.4,
    heading: (rand() - 0.5) * 0.8, // roughly pointing right
    speed: 0,
    maxSpeed: MAX_SPEED * (0.85 + rand() * 0.3),
    finishedTick: null,
    brain: factory(seed),
    trail: [],
  };
}

function sense(fly) {
  const dx = FOOD.x - fly.x;
  const dy = FOOD.y - fly.y;
  const dist = Math.hypot(dx, dy);
  let bearing = Math.atan2(dy, dx) - fly.heading;
  // Wrap to [-PI, PI].
  bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
  return { bearing, dist, proximity: Math.max(0, 1 - dist / WORLD.width) };
}

/**
 * A race is fully determined by (seed, brainKind). Both the server and every
 * browser instantiate this and get identical positions on identical ticks.
 */
export function createRace(seed, brainKind = 'randomWalk') {
  const flies = [];
  for (let i = 0; i < FLY_COUNT; i++) flies.push(makeFly(i, flySeed(seed, i), brainKind));

  let tick = 0;
  let winner = null;

  function step() {
    if (winner !== null || tick >= MAX_RACE_TICKS) return { done: true, winner };
    tick++;

    let bestFinisher = null;
    for (const fly of flies) {
      if (fly.finishedTick !== null) continue;
      const s = sense(fly);
      const { turn, thrust } = fly.brain.step(DT, s);

      fly.heading += Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, turn)) * DT;
      fly.speed = fly.maxSpeed * Math.max(0, Math.min(1, thrust));
      fly.x += Math.cos(fly.heading) * fly.speed * DT;
      fly.y += Math.sin(fly.heading) * fly.speed * DT;

      // Walls: reflect so a fly never sticks to an edge.
      if (fly.x < FLY_RADIUS) {
        fly.x = FLY_RADIUS;
        fly.heading = Math.PI - fly.heading;
      }
      if (fly.x > WORLD.width - FLY_RADIUS) {
        fly.x = WORLD.width - FLY_RADIUS;
        fly.heading = Math.PI - fly.heading;
      }
      if (fly.y < FLY_RADIUS) {
        fly.y = FLY_RADIUS;
        fly.heading = -fly.heading;
      }
      if (fly.y > WORLD.height - FLY_RADIUS) {
        fly.y = WORLD.height - FLY_RADIUS;
        fly.heading = -fly.heading;
      }

      fly.trail.push(fly.x, fly.y);
      if (fly.trail.length > 120) fly.trail.splice(0, fly.trail.length - 120);

      const d = Math.hypot(FOOD.x - fly.x, FOOD.y - fly.y);
      if (d <= FOOD.radius + FLY_RADIUS) {
        fly.finishedTick = tick;
        // Same-tick tie: the fly that got deepest into the food wins.
        if (bestFinisher === null || d < bestFinisher.d) bestFinisher = { fly, d };
      }
    }

    if (bestFinisher) winner = bestFinisher.fly.index;
    if (winner === null && tick >= MAX_RACE_TICKS) winner = closestFlyIndex();
    return { done: winner !== null, winner };
  }

  function closestFlyIndex() {
    let best = 0;
    let bestD = Infinity;
    for (const fly of flies) {
      const d = Math.hypot(FOOD.x - fly.x, FOOD.y - fly.y);
      if (d < bestD) {
        bestD = d;
        best = fly.index;
      }
    }
    return best;
  }

  return {
    seed,
    brainKind,
    flies,
    get tick() {
      return tick;
    },
    get winner() {
      return winner;
    },
    step,
  };
}

/**
 * Runs a race headlessly to completion. The server uses this to decide the
 * winner the moment a round locks, so the payout never depends on a client.
 */
export function runRace(seed, brainKind = 'randomWalk') {
  const race = createRace(seed, brainKind);
  let result = { done: false, winner: null };
  while (!result.done) result = race.step();
  return {
    seed,
    brainKind,
    winner: result.winner,
    ticks: race.tick,
    durationMs: Math.round(race.tick * DT * 1000),
    finishOrder: race.flies
      .map((f) => ({ index: f.index, finishedTick: f.finishedTick }))
      .sort((a, b) => (a.finishedTick ?? Infinity) - (b.finishedTick ?? Infinity)),
  };
}
