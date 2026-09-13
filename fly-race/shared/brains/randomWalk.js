import { gaussian, mulberry32 } from '../prng.js';

// Placeholder brain: correlated random walk with momentum, plus a weak bias
// toward the food so races actually finish. Swap for the LIF brain once real
// connectome data is loaded — the interface is just step() -> { turn, thrust }.
export function createRandomWalkBrain(seed) {
  const rand = mulberry32(seed);

  // Per-fly personality, drawn once from the seed so each fly looks distinct.
  const turnNoise = 2.2 + rand() * 3.6; // rad/s of wander
  const momentum = 0.82 + rand() * 0.14; // how much of last tick's turn carries over
  const foodBias = 0.5 + rand() * 1.5; // pull toward the target
  const thrustBase = 0.62 + rand() * 0.38;
  const thrustWobble = 0.1 + rand() * 0.25;
  const wobbleRate = 3 + rand() * 6;

  let turnState = 0;
  let t = 0;

  return {
    kind: 'randomWalk',
    debug: () => ({ turnNoise, momentum, foodBias, thrustBase }),
    step(dt, sense) {
      t += dt;
      const wander = gaussian(rand) * turnNoise;
      // sense.bearing is the signed angle to the food in [-PI, PI].
      const seek = Math.sin(sense.bearing) * foodBias * (0.4 + 0.6 * sense.proximity);
      turnState = turnState * momentum + (wander + seek) * (1 - momentum);
      const thrust = Math.max(
        0.15,
        thrustBase + Math.sin(t * wobbleRate) * thrustWobble
      );
      return { turn: turnState, thrust };
    },
  };
}
