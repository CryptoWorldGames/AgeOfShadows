// Plain-Node tests for the authoritative world simulation. Run: node worldsim.test.js
const assert = require('assert');
const W = require('./worldsim');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n    ', e.message); process.exitCode = 1; }
}

const P1 = { id: 'p1', name: 'Alice' };
const P2 = { id: 'p2', name: 'Bob' };

console.log('worldsim');

test('generateTrees produces spaced trees off the town center', () => {
  const trees = W.generateTrees(100);
  assert.strictEqual(trees.length, 100);
  for (const t of trees) {
    assert.ok(Math.hypot(t.x, t.z) >= 12, 'tree too close to town center');
    assert.strictEqual(t.state, 'standing');
    assert.strictEqual(t.hp, W.TREE_MAX_HP);
  }
});

test('chopping decrements hp and the feller becomes owner', () => {
  const t = W.freshTree('t', 30, 0);
  W.chopTree(t, P1, 1000);
  assert.strictEqual(t.hp, W.TREE_MAX_HP - 1);
  assert.strictEqual(t.ownerId, 'p1');
});

test('felling blow puts the tree into falling, then woodpile after FALL_MS', () => {
  const t = W.freshTree('t', 30, 0);
  for (let i = 0; i < W.TREE_MAX_HP; i++) W.chopTree(t, P1, 1000);
  assert.strictEqual(t.state, 'falling');
  // not yet
  assert.deepStrictEqual(W.tickTrees([t], 1000 + W.FALL_MS - 1), []);
  // now it drops
  const changed = W.tickTrees([t], 1000 + W.FALL_MS);
  assert.strictEqual(changed.length, 1);
  assert.strictEqual(t.state, 'woodpile');
  assert.strictEqual(t.droppedAt, 1000 + W.FALL_MS);
});

test('owner can gather immediately; non-owner cannot during claim window', () => {
  const t = W.freshTree('t', 30, 0);
  t.state = 'woodpile'; t.ownerId = 'p1'; t.ownerName = 'Alice'; t.droppedAt = 0;
  assert.strictEqual(W.canGather(t, 'p1', 1000), true);
  assert.strictEqual(W.canGather(t, 'p2', 1000), false); // Bob must wait
});

test('after CLAIM_MS the pile is free-for-all', () => {
  const t = W.freshTree('t', 30, 0);
  t.state = 'woodpile'; t.ownerId = 'p1'; t.droppedAt = 0;
  assert.strictEqual(W.canGather(t, 'p2', W.CLAIM_MS - 1), false);
  assert.strictEqual(W.canGather(t, 'p2', W.CLAIM_MS), true);
});

test('gathering empties the pile then sends it to respawning', () => {
  const t = W.freshTree('t', 30, 0);
  t.state = 'woodpile'; t.ownerId = 'p1'; t.droppedAt = 0;
  let total = 0;
  for (let i = 0; i < W.TREE_WOOD; i++) total += W.gatherWood(t, P1, 1000);
  assert.strictEqual(total, W.TREE_WOOD);
  assert.strictEqual(t.state, 'respawning');
  assert.strictEqual(W.gatherWood(t, P1, 1000), 0); // nothing left
});

test('respawning tree comes back full after RESPAWN_MS', () => {
  const t = W.freshTree('t', 30, 0);
  t.state = 'respawning'; t.respawnAt = 5000;
  assert.deepStrictEqual(W.tickTrees([t], 4999), []);
  W.tickTrees([t], 5000);
  assert.strictEqual(t.state, 'standing');
  assert.strictEqual(t.hp, W.TREE_MAX_HP);
  assert.strictEqual(t.wood, W.TREE_WOOD);
  assert.strictEqual(t.ownerId, null);
});

test('town center deposit banks 50%, house banks 100%', () => {
  const stock = { wood: 0 };
  assert.deepStrictEqual(W.applyDeposit(stock, { wood: 10 }, true), { wood: 5 });
  assert.strictEqual(stock.wood, 5);
  assert.deepStrictEqual(W.applyDeposit(stock, { wood: 10 }, false), { wood: 10 });
  assert.strictEqual(stock.wood, 15);
});

test('two players cannot gather the same last wood (server arbitrates)', () => {
  const t = W.freshTree('t', 30, 0);
  t.state = 'woodpile'; t.ownerId = null; t.droppedAt = 0; t.wood = 1;
  // free-for-all window
  const a = W.gatherWood(t, P1, W.CLAIM_MS);
  const b = W.gatherWood(t, P2, W.CLAIM_MS);
  assert.strictEqual(a + b, 1, 'only one wood should be handed out');
});

test('a unit walks to a tree, fells it, gathers, returns and deposits (offline loop)', () => {
  // one tree at (30,0); town centre at origin
  const trees = [W.freshTree('t', 30, 0)];
  const stock = { wood: 0 };
  const unit = { x: 0, z: 0 };
  const player = { id: 'p1', name: 'Alice' };
  let tNow = 0;
  // run ~120 simulated seconds at 0.25s steps
  for (let i = 0; i < 480; i++) {
    tNow += 250;
    W.tickTrees(trees, tNow);                 // fall->woodpile transitions
    W.stepUnit(unit, trees, stock, player, 0.25, tNow);
  }
  assert.ok(stock.wood > 0, 'unit should have banked some wood by walking the full loop');
  // banked is taxed (50%): from 10 wood gathered, ~5 kept per trip
  assert.ok(stock.wood >= 5, 'expected at least one full taxed deposit, got ' + stock.wood);
});

test('unit moves toward its target each step', () => {
  const unit = { x: 0, z: 0 };
  const arrived = W.moveToward(unit, 10, 0, 3);
  assert.strictEqual(arrived, false);
  assert.ok(unit.x > 0 && unit.x <= 3);
});

test('nearestWorkTree ignores depleted/respawning trees', () => {
  const trees = [W.freshTree('a', 5, 0), W.freshTree('b', 50, 0)];
  trees[0].state = 'respawning';
  const t = W.nearestWorkTree(trees, { x:0, z:0 }, 'p1', 1000);
  assert.strictEqual(t.id, 'b');
});

console.log(`\n${passed} passed`);
