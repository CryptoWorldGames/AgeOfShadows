import { mulberry32 } from '../prng.js';

/**
 * Leaky integrate-and-fire spiking network.
 *
 * This is the real brain the game is meant to run on. It is data-driven: hand
 * it a connectome and it runs it. Until FlyWire / MaleCNS data is wired in,
 * makePlaceholderConnectome() generates a small random sparse net with the same
 * shape, so the plumbing is exercised end to end.
 *
 * Connectome format (what a FlyWire/MaleCNS export should be converted to):
 *   {
 *     neurons: [{ id, type?: 'exc'|'inh' }, ...],
 *     synapses: [{ pre: id, post: id, weight: number }, ...],
 *     inputs:  { bearingLeft: id, bearingRight: id, proximity: id },
 *     outputs: { turnLeft: id, turnRight: id, thrust: id },
 *   }
 */

const V_REST = 0;
const V_THRESH = 1;
const V_RESET = -0.1;
const TAU_M = 0.02; // membrane time constant (s)
const TAU_S = 0.01; // synaptic current decay (s)
const REFRACTORY = 0.002; // s

export function makePlaceholderConnectome(seed, { size = 64, fanout = 6 } = {}) {
  const rand = mulberry32(seed);
  const neurons = [];
  for (let i = 0; i < size; i++) {
    neurons.push({ id: `n${i}`, type: rand() < 0.8 ? 'exc' : 'inh' });
  }
  const synapses = [];
  for (let i = 0; i < size; i++) {
    for (let k = 0; k < fanout; k++) {
      const j = Math.floor(rand() * size);
      if (j === i) continue;
      const sign = neurons[i].type === 'inh' ? -1 : 1;
      synapses.push({ pre: `n${i}`, post: `n${j}`, weight: sign * (0.15 + rand() * 0.5) });
    }
  }
  return {
    neurons,
    synapses,
    inputs: { bearingLeft: 'n0', bearingRight: 'n1', proximity: 'n2' },
    outputs: { turnLeft: `n${size - 3}`, turnRight: `n${size - 2}`, thrust: `n${size - 1}` },
  };
}

export function createLIFBrain(seed, connectome = makePlaceholderConnectome(seed)) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const index = new Map(connectome.neurons.map((n, i) => [n.id, i]));
  const n = connectome.neurons.length;

  const v = new Float64Array(n);
  const current = new Float64Array(n);
  const refractoryUntil = new Float64Array(n);
  const bias = new Float64Array(n);
  for (let i = 0; i < n; i++) bias[i] = 0.2 + rand() * 0.25; // tonic drive

  // Flatten synapses into CSR-ish arrays for fast stepping.
  const outEdges = connectome.neurons.map(() => []);
  for (const s of connectome.synapses) {
    const pre = index.get(s.pre);
    const post = index.get(s.post);
    if (pre === undefined || post === undefined) continue;
    outEdges[pre].push([post, s.weight]);
  }

  const io = (id) => index.get(id) ?? 0;
  const inBearingL = io(connectome.inputs.bearingLeft);
  const inBearingR = io(connectome.inputs.bearingRight);
  const inProximity = io(connectome.inputs.proximity);
  const outLeft = io(connectome.outputs.turnLeft);
  const outRight = io(connectome.outputs.turnRight);
  const outThrust = io(connectome.outputs.thrust);

  // Leaky spike-rate readouts on the motor neurons.
  let rateLeft = 0;
  let rateRight = 0;
  let rateThrust = 0;
  let t = 0;

  return {
    kind: 'lif',
    neuronCount: n,
    synapseCount: connectome.synapses.length,
    step(dt, sense) {
      t += dt;
      // Sensory drive: bearing split into two opponent channels.
      const b = Math.sin(sense.bearing);
      current[inBearingL] += Math.max(0, -b) * 6 * dt / TAU_S;
      current[inBearingR] += Math.max(0, b) * 6 * dt / TAU_S;
      current[inProximity] += sense.proximity * 4 * dt / TAU_S;

      const spikes = [];
      for (let i = 0; i < n; i++) {
        current[i] -= current[i] * (dt / TAU_S);
        if (t < refractoryUntil[i]) continue;
        v[i] += ((V_REST - v[i]) + current[i] + bias[i]) * (dt / TAU_M);
        if (v[i] >= V_THRESH) {
          v[i] = V_RESET;
          refractoryUntil[i] = t + REFRACTORY;
          spikes.push(i);
        }
      }
      for (const i of spikes) {
        for (const [post, w] of outEdges[i]) current[post] += w;
      }

      const decay = Math.exp(-dt / 0.05);
      rateLeft *= decay;
      rateRight *= decay;
      rateThrust *= decay;
      for (const i of spikes) {
        if (i === outLeft) rateLeft += 1;
        if (i === outRight) rateRight += 1;
        if (i === outThrust) rateThrust += 1;
      }

      return {
        turn: (rateRight - rateLeft) * 2.5,
        thrust: Math.min(1, 0.25 + rateThrust * 0.15),
      };
    },
  };
}
