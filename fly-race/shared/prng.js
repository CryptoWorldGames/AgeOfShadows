// Deterministic PRNG (mulberry32) + seed helpers.
// Nothing in the simulation may call Math.random(): a race must replay
// identically on the server (which decides the winner) and in every browser.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a: turns an arbitrary string (e.g. concatenated tx signatures) into a
// 32-bit seed.
export function hashStringToSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Per-fly seed derived from the round seed, so one round seed fans out into
// five distinct-looking flies.
export function flySeed(roundSeed, flyIndex) {
  return hashStringToSeed(`${roundSeed >>> 0}:fly:${flyIndex}`);
}

// Box-Muller, driven by a supplied uniform generator.
export function gaussian(rand) {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
