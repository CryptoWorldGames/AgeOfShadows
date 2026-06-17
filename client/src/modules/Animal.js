import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as SkeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SETTINGS } from './Settings.js';

const R2 = 'https://pub-9e79279ca165496da153d64ecb88f99c.r2.dev';
const loader = new GLTFLoader();
let chickenLoadPromise = null;
let deerLoadPromise = null;

function getChickenGLTF() {
  if (chickenLoadPromise) return chickenLoadPromise;
  chickenLoadPromise = new Promise((resolve, reject) => {
    loader.load(`${R2}/chicken.glb`, resolve, undefined, reject);
  });
  return chickenLoadPromise;
}

function getDeerGLTF() {
  if (deerLoadPromise) return deerLoadPromise;
  deerLoadPromise = new Promise((resolve, reject) => {
    const deerLoader = new GLTFLoader();
    deerLoader.setMeshoptDecoder(MeshoptDecoder);
    deerLoader.load(`${R2}/deer.glb`, resolve, undefined, reject);
  });
  return deerLoadPromise;
}

function makeAnimalHealthBar(scene, group, yOffset) {
  const hbGroup = new THREE.Group();
  hbGroup.position.y = yOffset;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false, transparent: true }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.11), new THREE.MeshBasicMaterial({ color: 0x22cc44, depthTest: false, transparent: true }));
  fill.position.z = 0.001; hbGroup.add(bg); hbGroup.add(fill); hbGroup.renderOrder = 999;
  group.add(hbGroup);
  return {
    group: hbGroup,
    update(frac) {
      frac = Math.max(0, Math.min(1, frac));
      fill.scale.x = frac; fill.position.x = -(1-frac)*0.6;
      fill.material.color.setHex(frac > 0.5 ? 0x22cc44 : frac > 0.25 ? 0xffaa00 : 0xff2222);
    },
    faceCamera(camera) { hbGroup.quaternion.copy(camera.quaternion); }
  };
}

function createMeatPile(scene, x, z, big) {
  const meatMat = new THREE.MeshStandardMaterial({ color: 0xc0584f, roughness: 0.9, flatShading: true });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.8 });
  const pile = new THREE.Group();
  const count = big ? 6 : 3;
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry((big ? 0.18 : 0.1) + Math.random() * 0.08, 5, 4), meatMat);
    m.position.set((Math.random()-0.5)*0.5, 0.08, (Math.random()-0.5)*0.5);
    m.scale.set(1, 0.6, 1); pile.add(m);
  }
  // Add a bone for deer
  if (big) {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), boneMat);
    bone.position.set(0.2, 0.1, 0.1); bone.rotation.z = 0.5; pile.add(bone);
  }
  pile.position.set(x, 0, z);
  scene.add(pile);
  return pile;
}

export function createChicken(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.y = 0.25; group.add(hitbox);

  const healthBar = makeAnimalHealthBar(scene, group, 0.9);

  let mixer = null, walkAction = null, scaredAction = null;
  let liveMeshes = [], deadMeshes = [], isMovingLocal = false;
  let meatPile = null;
  let selected = false;

  getChickenGLTF().then((gltf) => {
    const model = SkeletonClone(gltf.scene);
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    model.scale.setScalar(0.3 / Math.max(size.x, size.y, size.z));
    model.updateMatrixWorld(true);
    const bbox2 = new THREE.Box3().setFromObject(model);
    model.position.y = -bbox2.min.y;
    model.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true; c.receiveShadow = true; c.visible = true;
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((mat) => { mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; mat.visible = true; mat.needsUpdate = true; });
        }
        const matName = c.material?.name || (Array.isArray(c.material) ? c.material[0]?.name : '');
        if (matName.includes('chicken_roasted')) { c.visible = false; deadMeshes.push(c); }
        else { c.visible = true; liveMeshes.push(c); }
      }
    });
    group.add(model);
    mixer = new THREE.AnimationMixer(model);
    mixer.stopAllAction();
    const clipMap = {};
    (gltf.animations || []).forEach((clip) => { clipMap[clip.name.toLowerCase()] = clip; });
    const walkClip = clipMap['walk01'];
    const scaredClip = clipMap['chicken_scared01'] || clipMap['chicken_scared02'];
    if (walkClip) { walkAction = mixer.clipAction(THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(walkClip))); walkAction.loop = THREE.LoopRepeat; walkAction.play(); walkAction.paused = true; }
    if (scaredClip) { scaredAction = mixer.clipAction(THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(scaredClip))); scaredAction.loop = THREE.LoopRepeat; }
  }).catch((err) => {
    console.warn('Chicken GLB failed:', err);
    const bm = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.9, flatShading: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), bm); body.position.y = 0.18; body.scale.set(1, 0.85, 1.2); group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), bm); head.position.set(0, 0.31, 0.11); group.add(head);
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), new THREE.MeshStandardMaterial({ color: 0xdd2222 }));
    comb.position.set(0, 0.38, 0.09); comb.scale.set(0.5, 1, 0.5); group.add(comb);
    group.traverse((c) => { if (c.isMesh) liveMeshes.push(c); });
  });

  const S = SETTINGS.chicken; const cfg = SETTINGS.animal.chicken;
  let hp = S.hitsToKill, food = S.yield, state = 'wandering', respawnTimer = 0;
  let wanderTimer = Math.random() * 3, dyingT = 0, scaredTimer = 0;
  let wanderDir = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
  const spawnPos = new THREE.Vector3(position.x, 0, position.z);

  function setWalking(w) { if (!walkAction) return; walkAction.paused = !w; if (w && scaredAction) scaredAction.stop(); }
  function setScared() { if (walkAction) walkAction.paused = true; if (scaredAction) scaredAction.reset().play(); }
  function takeDamage(d) {
    if (state !== 'wandering') return; hp -= d;
    wanderDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
    wanderTimer = 0.3; scaredTimer = 2.0; setScared();
    if (hp <= 0) { hp = 0; state = 'dying'; dyingT = 0; }
  }
  function reset() {
    hp = S.hitsToKill; food = S.yield; state = 'wandering'; respawnTimer = 0; dyingT = 0; scaredTimer = 0;
    group.position.copy(spawnPos); group.position.x += (Math.random()-0.5)*4; group.position.z += (Math.random()-0.5)*4;
    group.rotation.y = Math.random()*Math.PI*2; group.rotation.z = 0; group.position.y = 0; group.visible = true;
    if (meatPile) { scene.remove(meatPile); meatPile = null; }
    liveMeshes.forEach((m) => { m.visible = true; }); deadMeshes.forEach((m) => { m.visible = false; });
    if (walkAction) { walkAction.reset().play(); walkAction.paused = true; }
    healthBar.update(1);
  }
  function update(dt, world) {
    if (mixer) mixer.update(dt);
    if (world && world.camera) healthBar.faceCamera(world.camera);
    healthBar.update(hp / S.hitsToKill);
    healthBar.group.visible = selected;

    if (state === 'wandering') {
      if (scaredTimer > 0) { scaredTimer -= dt; if (scaredTimer <= 0) setWalking(isMovingLocal); }
      wanderTimer -= dt;
      if (wanderTimer <= 0) {
        wanderTimer = 2 + Math.random()*4;
        wanderDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
        if (group.position.distanceTo(spawnPos) > cfg.wanderRange) wanderDir.subVectors(spawnPos, group.position).normalize();
      }
      const moving = wanderTimer > 1.5;
      if (moving !== isMovingLocal) { isMovingLocal = moving; if (scaredTimer <= 0) setWalking(moving); }
      if (moving) { group.position.x += wanderDir.x*cfg.wanderSpeed*dt; group.position.z += wanderDir.z*cfg.wanderSpeed*dt; group.rotation.y = Math.atan2(wanderDir.x, wanderDir.z); }
    } else if (state === 'dying') {
      dyingT += dt; const f = Math.min(1, dyingT/1.0);
      group.rotation.z = f*Math.PI/2; group.position.y = -f*0.1;
      if (f >= 1) {
        group.rotation.z = 0; group.position.y = 0;
        liveMeshes.forEach((m) => { m.visible = false; }); deadMeshes.forEach((m) => { m.visible = true; });
        if (mixer) mixer.stopAllAction(); food = S.yield; state = 'meatpile';
      }
    } else if (state === 'respawning') { respawnTimer += dt; if (respawnTimer >= cfg.respawnTime) reset(); }
  }

  return {
    group, type: 'chicken', position: () => group.position.clone(), state: () => state,
    foodRemaining: () => food, isDepleted: () => state === 'respawning', takeDamage,
    takeFood(n) { const give = Math.min(n, food); food -= give; if (food <= 0) { state = 'respawning'; deadMeshes.forEach((m) => { m.visible = false; }); } return give; },
    setSelected(b) { selected = b; },
    update
  };
}

export function createDeer(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 3.2), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.y = 1.2; group.add(hitbox);

  const healthBar = makeAnimalHealthBar(scene, group, 3.2);

  const S = SETTINGS.deer;
  let hp = 6, maxHp = 6, food = S ? S.yield : 20;
  let state = 'wandering', dyingT = 0, respawnTimer = 0;

  let mixer = null, idleAction = null;
  let allMeshes = [];
  let meatPile = null;
  let selected = false;
  let wanderTimer = Math.random() * 4 + 3;
  let targetRotation = Math.random() * Math.PI * 2;
  let currentRotation = targetRotation;

  getDeerGLTF().then((gltf) => {
    const model = SkeletonClone(gltf.scene);
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    model.scale.setScalar(3.6 / Math.max(size.x, size.y, size.z));
    model.updateMatrixWorld(true);
    model.rotation.z = 0;
    model.position.y = 0.65;
    model.rotation.x = 0.08;
    model.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true; c.receiveShadow = true;
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((mat) => { mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; mat.needsUpdate = true; });
        }
        allMeshes.push(c);
      }
    });
    group.add(model);
    mixer = new THREE.AnimationMixer(model);
    mixer.stopAllAction();
    const clips = gltf.animations || [];
    if (clips[0]) {
      idleAction = mixer.clipAction(clips[0]);
      idleAction.loop = THREE.LoopRepeat;
      idleAction.clampWhenFinished = false;
      idleAction.enabled = true;
      idleAction.setEffectiveWeight(1);
      idleAction.play();
    }
  }).catch((err) => console.warn('Deer GLB failed:', err));

  const cfg = SETTINGS.animal.deer;
  const spawnPos = new THREE.Vector3(position.x, 0, position.z);
  let fleeDir = new THREE.Vector3();

  function takeDamage(d) {
    if (state !== 'wandering') return;
    hp -= d;
    if (hp <= 0) { hp = 0; state = 'dying'; dyingT = 0; }
  }

  function reset() {
    hp = maxHp; food = S ? S.yield : 20; state = 'wandering'; dyingT = 0; respawnTimer = 0;
    group.position.copy(spawnPos);
    group.position.x += (Math.random()-0.5)*10; group.position.z += (Math.random()-0.5)*10;
    group.rotation.y = Math.random()*Math.PI*2; group.rotation.z = 0; group.position.y = 0;
    group.visible = true;
    if (meatPile) { scene.remove(meatPile); meatPile = null; }
    allMeshes.forEach((m) => { m.visible = true; });
    healthBar.update(1);
    if (idleAction) idleAction.play();
  }

  function update(dt, world) {
    if (mixer) mixer.update(dt);
    if (world && world.camera) healthBar.faceCamera(world.camera);
    healthBar.update(hp / maxHp);
    healthBar.group.visible = selected;

    if (state === 'dying') {
      dyingT += dt; const f = Math.min(1, dyingT / 1.5);
      group.rotation.z = f * Math.PI / 2;
      group.position.y = -f * 0.3;
      if (f >= 1) {
        // Create meat pile at death position
        meatPile = createMeatPile(scene, group.position.x, group.position.z, true);
        group.visible = false;
        if (mixer) mixer.stopAllAction();
        state = 'meatpile';
      }
      return;
    }

    if (state === 'meatpile') {
      respawnTimer += dt;
      if (respawnTimer >= (S ? S.respawnTime : 7200)) reset();
      return;
    }

    if (state !== 'wandering') return;

    let flee = false;
    if (world && world.units) {
      world.units.forEach((u) => {
        const dx = group.position.x - u.group.position.x;
        const dz = group.position.z - u.group.position.z;
        if (Math.sqrt(dx*dx+dz*dz) < 8) { fleeDir.set(dx, 0, dz).normalize(); flee = true; }
      });
    }

    if (flee) {
      const tooClose = world && world.units && world.units.some((u) => {
        const dx = group.position.x - u.group.position.x;
        const dz = group.position.z - u.group.position.z;
        return Math.sqrt(dx*dx+dz*dz) < 2.5;
      });
      if (!tooClose) {
        group.position.x += fleeDir.x * 0.8 * dt;
        group.position.z += fleeDir.z * 0.8 * dt;
        group.rotation.y = Math.atan2(fleeDir.x, fleeDir.z);
      }
    } else {
      wanderTimer -= dt;
      if (wanderTimer <= 0) {
        wanderTimer = 4 + Math.random() * 6;
        targetRotation = Math.random() * Math.PI * 2;
        if (group.position.distanceTo(spawnPos) > cfg.wanderRange) {
          group.position.x += (spawnPos.x - group.position.x) * 0.05;
          group.position.z += (spawnPos.z - group.position.z) * 0.05;
        }
      }
      let diff = targetRotation - currentRotation;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      currentRotation += diff * dt * 0.5;
      group.rotation.y = currentRotation;
    }
  }

  return {
    group, type: 'deer', position: () => meatPile ? meatPile.position.clone() : group.position.clone(),
    state: () => state,
    foodRemaining: () => food,
    isDepleted: () => state === 'respawning',
    canKill: true,
    takeDamage,
    takeFood(n) {
      const give = Math.min(n, food); food -= give;
      if (food <= 0) {
        state = 'respawning';
        if (meatPile) { scene.remove(meatPile); meatPile = null; }
      }
      return give;
    },
    setSelected(b) { selected = b; },
    update
  };
}