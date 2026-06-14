import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as SkeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SETTINGS } from './Settings.js';

const loader = new GLTFLoader();
let chickenLoadPromise = null;

function getChickenGLTF() {
  if (chickenLoadPromise) return chickenLoadPromise;
  chickenLoadPromise = new Promise((resolve, reject) => {
    loader.load('/models/chicken.glb', resolve, undefined, reject);
  });
  return chickenLoadPromise;
}

export function createChicken(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 0.25;
  group.add(hitbox);

  let mixer = null;
  let walkAction = null;
  let scaredAction = null;
  let liveMeshes = [];   // Object_7 chicken_catalan_tan
  let deadMeshes = [];   // Object_63 chicken_roasted
  let isMoving = false;
  let meatPileGroup = null;

  getChickenGLTF().then((gltf) => {
    const model = SkeletonClone(gltf.scene);
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const autoScale = 0.3 / maxDim;
    model.scale.setScalar(autoScale);
    model.updateMatrixWorld(true);
    const bbox2 = new THREE.Box3().setFromObject(model);
    model.position.y = -bbox2.min.y;

    model.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true; c.receiveShadow = true;
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((mat) => { mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; mat.needsUpdate = true; });
        }
        const matName = c.material?.name || (Array.isArray(c.material) ? c.material[0]?.name : '');
        if (matName.includes('chicken_roasted')) {
          // Dead chicken mesh — hide it at start
          c.visible = false;
          deadMeshes.push(c);
        } else {
          // Live chicken mesh — show it
          c.visible = true;
          liveMeshes.push(c);
        }
      }
    });
    group.add(model);

    mixer = new THREE.AnimationMixer(model);
    mixer.stopAllAction();

    const clips = gltf.animations || [];
    const clipMap = {};
    clips.forEach((clip) => { clipMap[clip.name.toLowerCase()] = clip; });

    const walkClip = clipMap['walk01'];
    const scaredClip = clipMap['chicken_scared01'] || clipMap['chicken_scared02'];

    if (walkClip) {
      walkAction = mixer.clipAction(THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(walkClip)));
      walkAction.loop = THREE.LoopRepeat;
      walkAction.play();
      walkAction.paused = true;
    }
    if (scaredClip) {
      scaredAction = mixer.clipAction(THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(scaredClip)));
      scaredAction.loop = THREE.LoopRepeat;
    }
    console.log('Chicken ready. live meshes:', liveMeshes.length, 'dead meshes:', deadMeshes.length);
  }).catch((err) => {
    console.warn('Chicken GLB failed, fallback:', err);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.9, flatShading: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), bodyMat);
    body.position.y = 0.18; body.scale.set(1, 0.85, 1.2); group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), bodyMat);
    head.position.set(0, 0.31, 0.11); group.add(head);
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), new THREE.MeshStandardMaterial({ color: 0xdd2222 }));
    comb.position.set(0, 0.38, 0.09); comb.scale.set(0.5, 1, 0.5); group.add(comb);
    group.traverse((c) => { if (c.isMesh) liveMeshes.push(c); });
  });

  const S = SETTINGS.chicken;
  const cfg = SETTINGS.animal.chicken;
  let hp = S.hitsToKill;
  let food = S.yield;
  let state = 'wandering';
  let respawnTimer = 0;
  let wanderTimer = Math.random() * 3;
  let wanderDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
  let dyingT = 0;
  let scaredTimer = 0;
  const spawnPos = new THREE.Vector3(position.x, 0, position.z);

  function setWalking(walking) {
    if (!walkAction) return;
    walkAction.paused = !walking;
    if (walking && scaredAction) scaredAction.stop();
  }

  function setScared() {
    if (walkAction) walkAction.paused = true;
    if (scaredAction) scaredAction.reset().play();
  }

  function takeDamage(d) {
    if (state !== 'wandering') return;
    hp -= d;
    wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    wanderTimer = 0.3; scaredTimer = 2.0;
    setScared();
    if (hp <= 0) { hp = 0; state = 'dying'; dyingT = 0; }
  }

  function reset() {
    hp = S.hitsToKill; food = S.yield; state = 'wandering';
    respawnTimer = 0; dyingT = 0; scaredTimer = 0;
    group.position.copy(spawnPos);
    group.position.x += (Math.random() - 0.5) * 4;
    group.position.z += (Math.random() - 0.5) * 4;
    group.rotation.y = Math.random() * Math.PI * 2;
    group.rotation.z = 0; group.position.y = 0;
    group.visible = true;
    if (meatPileGroup) { scene.remove(meatPileGroup); meatPileGroup = null; }
    liveMeshes.forEach((m) => { m.visible = true; });
    deadMeshes.forEach((m) => { m.visible = false; });
    if (walkAction) { walkAction.reset().play(); walkAction.paused = true; }
  }

  function update(dt, world) {
    if (mixer) mixer.update(dt);

    if (state === 'wandering') {
      if (scaredTimer > 0) {
        scaredTimer -= dt;
        if (scaredTimer <= 0) setWalking(isMoving);
      }
      wanderTimer -= dt;
      if (wanderTimer <= 0) {
        wanderTimer = 2 + Math.random() * 4;
        wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        if (group.position.distanceTo(spawnPos) > cfg.wanderRange) {
          wanderDir.subVectors(spawnPos, group.position).normalize();
        }
      }
      const moving = wanderTimer > 1.5;
      if (moving !== isMoving) {
        isMoving = moving;
        if (scaredTimer <= 0) setWalking(moving);
      }
      if (moving) {
        group.position.x += wanderDir.x * cfg.wanderSpeed * dt;
        group.position.z += wanderDir.z * cfg.wanderSpeed * dt;
        group.rotation.y = Math.atan2(wanderDir.x, wanderDir.z);
      }

    } else if (state === 'dying') {
      dyingT += dt;
      const f = Math.min(1, dyingT / 1.0);
      group.rotation.z = f * Math.PI / 2;
      group.position.y = -f * 0.1;
      if (f >= 1) {
        group.rotation.z = 0; group.position.y = 0;
        // Hide live chicken, show roasted chicken at death spot
        liveMeshes.forEach((m) => { m.visible = false; });
        deadMeshes.forEach((m) => { m.visible = true; });
        if (mixer) mixer.stopAllAction();
        food = S.yield;
        state = 'meatpile';
      }

    } else if (state === 'respawning') {
      respawnTimer += dt;
      if (respawnTimer >= cfg.respawnTime) reset();
    }
  }

  return {
    group, type: 'chicken',
    position: () => group.position.clone(),
    state: () => state,
    foodRemaining: () => food,
    isDepleted: () => state === 'respawning',
    takeDamage,
    takeFood(n) {
      const give = Math.min(n, food);
      food -= give;
      if (food <= 0) {
        state = 'respawning';
        deadMeshes.forEach((m) => { m.visible = false; });
      }
      return give;
    },
    update
  };
}

export function createDeer(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  scene.add(group);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.9, flatShading: true });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.9, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5), bodyMat);
  body.position.y = 0.75; body.scale.set(1, 0.7, 1.5); body.castShadow = true; group.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), bellyMat);
  belly.position.set(0, 0.55, 0.1); belly.scale.set(0.8, 0.5, 1.2); group.add(belly);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 6), bodyMat);
  neck.position.set(0, 1.05, 0.45); neck.rotation.x = -0.5; neck.castShadow = true; group.add(neck);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), bodyMat);
  headMesh.position.set(0, 1.32, 0.7); headMesh.scale.set(0.85, 0.9, 1.1); headMesh.castShadow = true; group.add(headMesh);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), bellyMat);
  snout.position.set(0, 1.25, 0.9); snout.scale.set(0.8, 0.6, 0.8); group.add(snout);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x7a4e2d, roughness: 0.9, flatShading: true });
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), earMat);
  earL.position.set(-0.18, 1.52, 0.65); earL.rotation.z = -0.3; group.add(earL);
  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), earMat);
  earR.position.set(0.18, 1.52, 0.65); earR.rotation.z = 0.3; group.add(earR);
  const antlerMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 1.0 });
  [[-0.12, -0.2], [0.12, 0.2]].forEach(([ox, rz]) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.35, 4), antlerMat);
    base.position.set(ox, 1.72, 0.62); base.rotation.z = rz; group.add(base);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.22, 4), antlerMat);
    branch.position.set(ox * 1.6, 1.9, 0.58); branch.rotation.z = rz * 3.5; group.add(branch);
  });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x7a4e2d, roughness: 0.9, flatShading: true });
  const legs = [];
  [[-0.22, 0.3], [0.22, 0.3], [-0.22, -0.3], [0.22, -0.3]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.75, 5), legMat);
    leg.position.set(lx, 0.38, lz); leg.castShadow = true; group.add(leg); legs.push(leg);
  });
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), bellyMat);
  tail.position.set(0, 0.85, -0.72); group.add(tail);

  const cfg = SETTINGS.animal.deer;
  let wanderTimer = Math.random() * 3;
  let wanderDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
  let walkClock = 0;
  let isRunning = false;
  let runTimer = 0;
  const spawnPos = new THREE.Vector3(position.x, 0, position.z);

  function update(dt, world) {
    walkClock += dt * (isRunning ? 12 : 5);
    const s = Math.sin(walkClock);
    legs[0].rotation.x = s * 0.5; legs[1].rotation.x = -s * 0.5;
    legs[2].rotation.x = -s * 0.4; legs[3].rotation.x = s * 0.4;
    headMesh.position.y = 1.32 + Math.abs(s) * 0.03;
    let flee = false;
    if (world && world.units) {
      world.units.forEach((u) => {
        const dx = group.position.x - u.group.position.x;
        const dz = group.position.z - u.group.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 8) { wanderDir.set(dx, 0, dz).normalize(); flee = true; }
      });
    }
    if (flee) { isRunning = true; runTimer = 3; }
    else if (runTimer > 0) { runTimer -= dt; if (runTimer <= 0) isRunning = false; }
    wanderTimer -= dt;
    if (wanderTimer <= 0 && !flee) {
      wanderTimer = 3 + Math.random() * 5;
      wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      if (group.position.distanceTo(spawnPos) > cfg.wanderRange) {
        wanderDir.subVectors(spawnPos, group.position).normalize();
      }
    }
    const spd = isRunning ? cfg.wanderSpeed : cfg.wanderSpeed * 0.3;
    group.position.x += wanderDir.x * spd * dt;
    group.position.z += wanderDir.z * spd * dt;
    group.rotation.y = Math.atan2(wanderDir.x, wanderDir.z);
  }

  return {
    group, type: 'deer',
    position: () => group.position.clone(),
    state: () => 'wandering',
    isDepleted: () => false,
    canKill: false,
    update
  };
}