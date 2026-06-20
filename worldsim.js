// worldsim.js — Age of Shadows authoritative world simulation.
//
// Pure(-ish) logic that the SERVER owns so every player shares ONE world:
// the same trees in the same places, the same state, arbitrated server-side.
// Kept free of socket.io / express so it can be unit-tested with plain Node.
//
// Tree lifecycle:  standing --(chopped to 0 hp)--> falling --(FALL_MS)-->
//                  woodpile --(all wood taken)--> respawning --(RESPAWN_MS)--> standing
//
// Ownership:  whoever fells a tree owns its woodpile. For CLAIM_MS after the
// wood drops, only the owner may gather it. After that it's free-for-all so
// players can fight over abandoned loot.

const TREE_COUNT   = 100;
const TREE_MAX_HP  = 10;
const TREE_WOOD    = 10;
const FALL_MS      = 3000;            // visible fall/sink before the pile appears
const RESPAWN_MS   = 15 * 60 * 1000;  // pile cleared -> tree grows back
const CLAIM_MS     = 5 * 60 * 1000;   // owner-only window after wood drops
const TC_TAX       = 0.5;             // Town Center takes 50%
const TOWN_CENTER  = { x: 0, z: 0 };

// Map generation constraints (mirror the look the client used before).
const POND = { x: -35, z: -30, r: 11 };
const CENTER_CLEAR = 12;   // keep trees off the town center
const MIN_SPACING  = 4;    // trees don't overlap

function nowMs() { return Date.now(); }

function freshTree(id, x, z) {
  return {
    id, x, z,
    type: 'tree',
    hp: TREE_MAX_HP, maxHp: TREE_MAX_HP,
    wood: TREE_WOOD, maxWood: TREE_WOOD,
    state: 'standing',
    ownerId: null, ownerName: null,
    choppedAt: 0,    // last time someone hit it
    fallAt: 0,       // when falling -> woodpile
    droppedAt: 0,    // when the woodpile appeared (starts CLAIM_MS timer)
    respawnAt: 0,    // when respawning -> standing
  };
}

function generateTrees(n = TREE_COUNT, rng = Math.random) {
  const trees = [];
  const used = [];
  const inPond = (x, z) => Math.hypot(x - POND.x, z - POND.z) < POND.r;
  const tooClose = (x, z) => used.some((s) => Math.hypot(x - s.x, z - s.z) < MIN_SPACING);
  let attempts = 0;
  while (trees.length < n && attempts < n * 80) {
    attempts++;
    const x = (rng() - 0.5) * 150;
    const z = (rng() - 0.5) * 150;
    if (Math.hypot(x, z) < CENTER_CLEAR) continue;
    if (inPond(x, z)) continue;
    if (tooClose(x, z)) continue;
    used.push({ x, z });
    trees.push(freshTree(`tree_${trees.length}`, x, z));
  }
  return trees;
}

function resetTree(t) {
  t.hp = TREE_MAX_HP; t.wood = TREE_WOOD;
  t.state = 'standing';
  t.ownerId = null; t.ownerName = null;
  t.choppedAt = 0; t.fallAt = 0; t.droppedAt = 0; t.respawnAt = 0;
}

// Advance time-based transitions. Returns the list of trees that changed so the
// caller can broadcast just the deltas.
function tickTrees(trees, tNow = nowMs()) {
  const changed = [];
  for (const t of trees) {
    if (t.state === 'falling' && tNow >= t.fallAt) {
      t.state = 'woodpile';
      t.droppedAt = tNow;
      changed.push(t);
    } else if (t.state === 'respawning' && tNow >= t.respawnAt) {
      resetTree(t);
      changed.push(t);
    }
  }
  return changed;
}

// A player swings at a standing tree. Whoever lands the felling blow owns it.
// Returns the tree if something changed, else null.
function chopTree(tree, player, tNow = nowMs()) {
  if (!tree || tree.state !== 'standing') return null;
  tree.ownerId = player.id;
  tree.ownerName = player.name;
  tree.choppedAt = tNow;
  tree.hp = Math.max(0, tree.hp - 1);
  if (tree.hp <= 0) {
    tree.state = 'falling';
    tree.fallAt = tNow + FALL_MS;
  }
  return tree;
}

// Can this player take wood from this pile right now?
function canGather(tree, playerId, tNow = nowMs()) {
  if (!tree || tree.state !== 'woodpile' || tree.wood <= 0) return false;
  if (tree.ownerId && tree.ownerId === playerId) return true;   // owner always may
  return tNow >= (tree.droppedAt || 0) + CLAIM_MS;              // others wait 5 min
}

// Take one wood from a pile (respecting ownership). Returns amount gathered (0/1).
function gatherWood(tree, player, tNow = nowMs()) {
  if (!canGather(tree, player.id, tNow)) return 0;
  const got = Math.min(1, tree.wood);
  tree.wood -= got;
  if (tree.wood <= 0) {
    tree.state = 'respawning';
    tree.respawnAt = tNow + RESPAWN_MS;
    tree.ownerId = null; tree.ownerName = null;
  }
  return got;
}

/* ============================================================
   SERVER-SIDE WORKER SIMULATION
   Each unit runs a gather -> deposit loop entirely on the server, so it keeps
   working whether the player is online, AFK, or logged out. Pure functions that
   mutate the unit/trees/stockpile in place so they can be unit-tested.
   ============================================================ */
const UNIT_SPEED   = 3.0;   // metres / second
const CARRY_MAX    = 10;    // wood carried before returning to deposit
const REACH        = 2.2;   // how close to a tree/town centre counts as "arrived"
const CHOP_EVERY   = 0.5;   // seconds between chop hits
const GATHER_EVERY = 0.5;   // seconds between picking up 1 wood

// Move a unit toward (x,z) by up to `step`. Returns true once it arrives.
function moveToward(unit, x, z, step) {
  const dx = x - unit.x, dz = z - unit.z;
  const d = Math.hypot(dx, dz);
  if (d <= step || d < 1e-6) { unit.x = x; unit.z = z; return true; }
  unit.x += (dx / d) * step;
  unit.z += (dz / d) * step;
  return false;
}

// Nearest tree this unit may work: a standing tree, or a woodpile it can gather.
function nearestWorkTree(trees, unit, playerId, tNow) {
  let best = null, bestD = Infinity;
  for (const t of trees) {
    const workable = t.state === 'standing' || (t.state === 'woodpile' && t.wood > 0 && canGather(t, playerId, tNow));
    if (!workable) continue;
    const d = Math.hypot(t.x - unit.x, t.z - unit.z);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

// Advance ONE unit by dt seconds. Mutates unit, trees, and the player's stockpile.
function stepUnit(unit, trees, stockpile, player, dt, tNow = nowMs()) {
  if (unit.task == null) unit.task = 'gatherWood';
  if (unit.carry == null) unit.carry = 0;
  if (unit.phase == null) unit.phase = 'toResource';
  const step = UNIT_SPEED * dt;

  // --- MANUAL MOVE COMMAND (player clicked the ground): go there, then resume work ---
  if (unit.cmd && unit.cmd.type === 'move') {
    if (moveToward(unit, unit.cmd.x, unit.cmd.z, step)) { unit.cmd = null; unit.moving = false; }
    else unit.moving = true;
    return;
  }

  // Returning to the town centre to deposit.
  if (unit.phase === 'returning') {
    if (moveToward(unit, TOWN_CENTER.x, TOWN_CENTER.z, step)) {
      const kept = Math.floor(unit.carry * (1 - TC_TAX));   // 50% town-centre tax
      stockpile.wood = (stockpile.wood || 0) + kept;
      unit.deposited = (unit.deposited || 0) + kept;
      unit.carry = 0;
      unit.phase = 'toResource';
      unit.targetTreeId = null;
    }
    unit.moving = true;
    return;
  }

  // Keep our current target while it's standing, mid-fall, OR a pile we can still
  // gather — only pick a NEW tree when the current one is truly done. (This is the
  // fix: don't abandon the tree we just felled while it's falling.)
  let tree = unit.targetTreeId && trees.find(t => t.id === unit.targetTreeId);
  let keep = false;
  if (tree) {
    if (tree.state === 'standing' || tree.state === 'falling') keep = true;
    else if (tree.state === 'woodpile' && tree.wood > 0 && canGather(tree, player.id, tNow)) keep = true;
  }
  if (!keep) {
    tree = nearestWorkTree(trees, unit, player.id, tNow);
    unit.targetTreeId = tree ? tree.id : null;
    unit._t = 0;
  }
  if (!tree) {
    // nothing to chop right now; if we're carrying anything, go bank it
    if (unit.carry > 0) { unit.phase = 'returning'; return; }
    unit.moving = false; return;
  }

  const dist = Math.hypot(tree.x - unit.x, tree.z - unit.z);
  if (dist > REACH) { moveToward(unit, tree.x, tree.z, step); unit.moving = true; return; }

  // In range — stand still and work.
  unit.moving = false;
  if (tree.state === 'falling') return;                 // wait for it to hit the ground
  unit._t = (unit._t || 0) + dt;
  if (tree.state === 'standing') {
    if (unit._t >= CHOP_EVERY) { unit._t = 0; chopTree(tree, player, tNow); }
  } else if (tree.state === 'woodpile') {
    if (unit._t >= GATHER_EVERY) {
      unit._t = 0;
      unit.carry += gatherWood(tree, player, tNow);
      if (unit.carry >= CARRY_MAX) { unit.phase = 'returning'; unit.targetTreeId = null; }
    }
  }
}

// Apply a deposit of carried resources into a player's persistent stockpile.
// Town Center charges TC_TAX; a player's own house is tax-free. Mutates
// stockpile in place and returns the net amounts actually banked.
function applyDeposit(stockpile, carried, isTownCenter) {
  const taxRate = isTownCenter ? TC_TAX : 0;
  const banked = {};
  for (const key of Object.keys(carried || {})) {
    const amount = Math.max(0, carried[key] || 0);
    if (!amount) continue;
    const kept = Math.floor(amount * (1 - taxRate));
    stockpile[key] = (stockpile[key] || 0) + kept;
    banked[key] = kept;
  }
  return banked;
}

module.exports = {
  // constants (exported for the server + tests)
  TREE_COUNT, TREE_MAX_HP, TREE_WOOD, FALL_MS, RESPAWN_MS, CLAIM_MS, TC_TAX, TOWN_CENTER,
  UNIT_SPEED, CARRY_MAX, REACH,
  // functions
  nowMs, freshTree, generateTrees, resetTree, tickTrees,
  chopTree, canGather, gatherWood, applyDeposit,
  moveToward, nearestWorkTree, stepUnit,
};
