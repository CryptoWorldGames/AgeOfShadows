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
  // functions
  nowMs, freshTree, generateTrees, resetTree, tickTrees,
  chopTree, canGather, gatherWood, applyDeposit,
};
