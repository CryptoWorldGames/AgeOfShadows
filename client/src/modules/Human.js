import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = '/models/balkan__cs2_agent_model_dragomir_no1.glb';

let audioCtx = null;
function playChop() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.16);
    const n = Math.floor(audioCtx.sampleRate * 0.05);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.28, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(ng); ng.connect(audioCtx.destination);
    noise.start(now);
  } catch (e) {}
}

function makeHealthBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.16),
    new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false, transparent: true })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false, transparent: true })
  );
  fill.position.z = 0.001;
  g.add(bg); g.add(fill);
  g.renderOrder = 999;
  return {
    group: g,
    update(frac) {
      frac = Math.max(0, Math.min(1, frac));
      fill.scale.x = frac;
      fill.position.x = -(1 - frac) * 0.5;
    }
  };
}

function makeAxe() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 })
  );
  handle.position.y = -0.35;
  handle.castShadow = true;
  g.add(handle);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.16, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.35 })
  );
  head.position.set(0.13, -0.62, 0);
  head.castShadow = true;
  g.add(head);
  return g;
}

export function createHuman(scene, position = { x: 0, y: 0, z: 0 }, options = {}) {
  const team = options.team || 'red';
  const tint = team === 'blue'
    ? new THREE.Color(0.55, 0.6, 1.4)
    : new THREE.Color(1.4, 0.55, 0.55);

  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  scene.add(group);

  const modelHolder = new THREE.Group();
  group.add(modelHolder);

  const axeHolder = new THREE.Group();
  const axe = makeAxe();
  axeHolder.add(axe);
  modelHolder.add(axeHolder);

  const healthBar = makeHealthBar();
  healthBar.group.position.y = 2.3;
  group.add(healthBar.group);

  let modelCenterY = 1.0;
  const B = {};
  const rest = {};
  let handR = null;
  const handWorld = new THREE.Vector3();

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true; c.receiveShadow = true;
          if (c.material) {
            c.material = c.material.clone();
            if (c.material.color) c.material.color.multiply(tint);
          }
        }
      });
      modelHolder.add(model);

      const bbox = new THREE.Box3().setFromObject(model);
      modelCenterY = (bbox.min.y + bbox.max.y) / 2;

      const want = {
        legUL: 'leg_upper_l_65', legLL: 'leg_lower_l_63',
        legUR: 'leg_upper_r_70', legLR: 'leg_lower_r_68',
        armUL: 'arm_upper_l_28', armUR: 'arm_upper_r_55',
        spine: 'spine_2_58'
      };
      model.traverse((o) => {
        if (!o.isBone) return;
        for (const key in want) {
          if (o.name === want[key]) {
            B[key] = o;
            rest[key] = o.rotation.clone();
          }
        }
        if (o.name === 'hand_r_49') handR = o;
      });

      console.log('[' + team + '] bones bound:', Object.keys(B).join(', '), '| hand:', handR ? 'yes' : 'no');
    },
    undefined,
    (err) => console.error('Failed to load character:', err)
  );

  let target = null;
  let chopTarget = null;
  let chopSlot = null;
  let moving = false;
  let walkClock = 0;
  let chopPhase = 0;
  let gatherTimer = 0;
  let chopActive = false;
  let frozen = false;

  const radius = 0.5;
  const speed = 2.4;
  const chopRange = 1.8;   // close enough to the tree to start chopping
  const gatherRange = 1.6;
  const swingInterval = 0.7;
  const gatherInterval = 2.0;

  const axeRestRot = { x: 0.5, y: 0, z: 0.2 };
  let axeRot = { x: 0.5, y: 0, z: 0.2 };

  function resetPose() {
    for (const key in B) {
      if (rest[key]) B[key].rotation.copy(rest[key]);
    }
  }

  function distTo(x, z) {
    const dx = x - group.position.x;
    const dz = z - group.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function faceToward(tx, tz) {
    const dx = tx - group.position.x;
    const dz = tz - group.position.z;
    if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) {
      modelHolder.rotation.y = Math.atan2(dx, dz);
    }
  }

  function moveToward(dest, dt, stopDist) {
    const me = group.position;
    let dx = dest.x - me.x, dz = dest.z - me.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= stopDist) return true;
    dx /= dist; dz /= dist;
    const step = Math.min(speed * dt, dist - stopDist);
    me.x += dx * step; me.z += dz * step;
    faceToward(me.x + dx * 10, me.z + dz * 10);
    return false;
  }

  function separate(world) {
    if (frozen) return;
    const me = group.position;
    world.units.forEach((o) => {
      if (o === unit) return;
      // don't shove a worker who's frozen at a resource
      let dx = me.x - o.group.position.x, dz = me.z - o.group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minD = radius + o.radius;
      if (dist > 1e-4 && dist < minD) {
        const push = (minD - dist) * 0.5;
        me.x += (dx / dist) * push; me.z += (dz / dist) * push;
      }
    });
    world.trees.forEach((t) => {
      if (t.isDepleted()) return;
      if (t === chopTarget) return;
      const tp = t.position();
      let dx = me.x - tp.x, dz = me.z - tp.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minD = radius + 0.35;
      if (dist > 1e-4 && dist < minD) {
        const push = (minD - dist) * 0.5;
        me.x += (dx / dist) * push; me.z += (dz / dist) * push;
      }
    });
  }

  function walkPose(dt) {
    walkClock += dt * 7;
    const s = Math.sin(walkClock);
    if (B.legUL) B.legUL.rotation.x = rest.legUL.x + s * 0.5;
    if (B.legUR) B.legUR.rotation.x = rest.legUR.x - s * 0.5;
    if (B.legLL) B.legLL.rotation.x = rest.legLL.x + Math.max(0, -s) * 0.6;
    if (B.legLR) B.legLR.rotation.x = rest.legLR.x + Math.max(0, s) * 0.6;
    if (B.armUL) B.armUL.rotation.x = rest.armUL.x - s * 0.35;
    if (B.armUR) B.armUR.rotation.x = rest.armUR.x + s * 0.35;
    modelHolder.position.y = Math.abs(Math.sin(walkClock)) * 0.04;
  }

  function chopPose(dt, tree) {
    chopActive = true;
    chopPhase += dt / swingInterval;
    let p = chopPhase;
    let armA;
    if (p < 0.55) armA = (p / 0.55) * -1.8;
    else armA = -1.8 + ((p - 0.55) / 0.45) * 2.3;
    if (B.armUR) B.armUR.rotation.x = rest.armUR.x + armA;
    if (B.spine) B.spine.rotation.x = rest.spine.x + Math.min(0, armA + 0.8) * 0.2;

    if (p < 0.55) {
      const t = p / 0.55;
      axeRot.x = 0.5 - 2.1 * t;
      axeRot.z = 0.2 + 0.6 * t;
    } else {
      const t = (p - 0.55) / 0.45;
      axeRot.x = -1.6 + 2.1 * t;
      axeRot.z = 0.8 - 1.4 * t;
    }

    if (chopPhase >= 1) {
      chopPhase = 0;
      tree.takeDamage(1);
      playChop();
    }
  }

  function update(dt, world) {
    resetPose();
    moving = false;
    chopActive = false;
    frozen = false;

    if (chopTarget) {
      if (chopTarget.isDepleted()) { chopTarget = null; chopSlot = null; }
      else {
        const tp = chopTarget.position();
        const st = chopTarget.state();
        const dTree = distTo(tp.x, tp.z);

        if (st === 'woodpile') {
          if (chopTarget.woodRemaining() > 0) {
            // Already close enough? Freeze and gather. Else walk to slot.
            if (dTree <= gatherRange) {
              frozen = true;
              faceToward(tp.x, tp.z);
              gatherTimer += dt;
              if (gatherTimer >= gatherInterval) {
                gatherTimer = 0;
                const got = chopTarget.takeWood(1);
                if (world.resources) world.resources.wood += got;
              }
            } else {
              const dest = chopSlot ? chopSlot : tp;
              moveToward(dest, dt, 0.15);
              moving = true;
            }
          } else { chopTarget = null; chopSlot = null; }
        } else {
          // STANDING tree: freeze as soon as within chopRange of the TREE,
          // regardless of exact slot — prevents walk-in-place.
          if (dTree <= chopRange) {
            frozen = true;
            faceToward(tp.x, tp.z);
            if (st === 'standing') chopPose(dt, chopTarget);
          } else {
            const dest = chopSlot ? chopSlot : tp;
            moveToward(dest, dt, 0.15);
            moving = true;
          }
        }
      }
    } else if (target) {
      const arrived = moveToward(target, dt, 0.05);
      if (arrived) target = null; else moving = true;
    }

    if (moving) walkPose(dt);
    else modelHolder.position.y *= 0.7;

    if (!chopActive) {
      axeRot.x += (axeRestRot.x - axeRot.x) * 0.3;
      axeRot.y += (axeRestRot.y - axeRot.y) * 0.3;
      axeRot.z += (axeRestRot.z - axeRot.z) * 0.3;
    }

    separate(world);

    if (handR) {
      handR.getWorldPosition(handWorld);
      axeHolder.parent.worldToLocal(axeHolder.position.copy(handWorld));
      axeHolder.rotation.set(axeRot.x, axeRot.y, axeRot.z);
    }

    if (world.camera) healthBar.group.quaternion.copy(world.camera.quaternion);
    healthBar.update(unit.health / unit.maxHealth);
  }

  const unit = {
    group, type: 'unit', team, radius,
    health: 100, maxHealth: 100,
    selected: false,
    getModelCenterY: () => modelCenterY,
    setSelected(b) { unit.selected = b; },
    moveTo(v) { target = v.clone(); chopTarget = null; chopSlot = null; chopPhase = 0; },
    chopTree(tree, slot) { chopTarget = tree; chopSlot = slot || null; target = null; chopPhase = 0; },
    stop() { target = null; chopTarget = null; chopSlot = null; },
    update,
    animate() {}
  };

  return unit;
}