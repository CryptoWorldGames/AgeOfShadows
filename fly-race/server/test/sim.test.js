import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, runRace } from '../../shared/sim.js';
import { FLY_COUNT } from '../../shared/constants.js';

test('a race is deterministic for a given seed', () => {
  const a = runRace(12345);
  const b = runRace(12345);
  assert.equal(a.winner, b.winner);
  assert.equal(a.ticks, b.ticks);
});

test('different seeds generally produce different outcomes', () => {
  const winners = new Set();
  for (let s = 0; s < 40; s++) winners.add(runRace(s * 7919).winner);
  assert.ok(winners.size > 1, 'every seed produced the same winner');
});

test('every fly can win across many seeds', () => {
  const counts = new Array(FLY_COUNT).fill(0);
  for (let s = 0; s < 300; s++) counts[runRace(s).winner] += 1;
  for (let i = 0; i < FLY_COUNT; i++) {
    assert.ok(counts[i] > 0, `fly ${i} never won in 300 races: ${counts.join(',')}`);
  }
});

test('races finish by actually reaching the food, not by timeout', () => {
  let reached = 0;
  for (let s = 0; s < 50; s++) {
    const r = runRace(s + 1000);
    if (r.finishOrder[0].finishedTick !== null) reached += 1;
  }
  assert.ok(reached >= 45, `only ${reached}/50 races were won at the food`);
});

test('stepped playback matches the headless result', () => {
  const headless = runRace(999);
  const race = createRace(999);
  let guard = 0;
  while (race.winner === null && guard++ < 100000) race.step();
  assert.equal(race.winner, headless.winner);
  assert.equal(race.tick, headless.ticks);
});

test('lif brain runs and produces a winner', () => {
  const r = runRace(4242, 'lif');
  assert.ok(r.winner >= 0 && r.winner < FLY_COUNT);
});
