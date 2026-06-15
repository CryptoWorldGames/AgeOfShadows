import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as SkeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SETTINGS } from './Settings.js';

const loader = new GLTFLoader();
let chickenLoadPromise = null;
let deerLoadPromise = null;

function getChickenGLTF() {
  if (chickenLoadPromise) return chickenLoadPromise;
  chickenLoadPromise = new Promise((resolve, reject) => {
    loader.load('/models/chicken.glb', resolve, undefined, reject);
  });
  return chickenLoadPromise;
}

function getDeerGLTF() {
  if (deerLoadPromise) return deerLoadPromise;
  deerLoadPromise = new Promise((resolve, reject) => {
    const deerLoader = new GLTFLoader();
    deerLoader.setMeshoptDecoder(MeshoptDecoder);
    deerLoader.load('/models/deer.glb', resolve, undefined, reject);
  });
  return deerLoadPromise;
}

// ===== CHICKEN =====
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
  let liveMeshes = [];
  let deadMeshes = [];
  let isMoving = false;

  getChickenGLTF().then((gltf) => {
    const model = SkeletonClone(gltf.scene);
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    model.scale.setScalar(0.3 / maxDim);
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
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), new THREE.MeshStandardMaterial({ color: 0xdd2222 })); comb.position.set(0, 0.38, 0.09); comb.scale.set(0.5, 1, 0.5); group.add(comb);
    group.traverse((c) => { if (c.isMesh) liveMeshes.push(c); });
  });

  const S = SETTINGS.chicken; const cfg = SETTINGS.animal.chicken;
  let hp = S.hitsToKill, food = S.yield, state = 'wandering', respawnTimer = 0;
  let wanderTimer = Math.random() * 3, dyingT = 0, scaredTimer = 0, isMovingLocal = false;
  let wanderDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
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
    liveMeshes.forEach((m) => { m.visible = true; }); deadMeshes.forEach((m) => { m.visible = false; });
    if (walkAction) { walkAction.reset().play(); walkAction.paused = true; }
  }
  function update(dt, world) {
    if (mixer) mixer.update(dt);
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
    update
  };
}

// ===== DEER =====
export function createDeer(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.y = 0.6; group.add(hitbox);

  let mixer = null, idleAction = null, walkAction = null, runAction = null;
  let isRunning = false;

  getDeerGLTF().then((gltf) => {
    const model = SkeletonClone(gltf.scene);
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    model.scale.setScalar(1.2 / maxDim);
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
      }
    });
    group.add(model);

    mixer = new THREE.AnimationMixer(model);
    mixer.stopAllAction();
    const clips = gltf.animations || [];
    console.log('Deer animations:', clips.map(c => c.name));
    const clipMap = {};
    clips.forEach((clip) => { clipMap[clip.name.toLowerCase()] = clip; });

    const idleClip = clipMap['idle'] || clipMap['idle01'] || clipMap['stand'] || clips[0];
    const walkClip = clipMap['walk'] || clipMap['walk01'] || clipMap['walking'] || clips[1];
    const runClip = clipMap['run'] || clipMap['run01'] || clipMap['gallop'] || clipMap['trot'] || clips[2];

    if (idleClip) { idleAction = mixer.clipAction(idleClip); idleAction.loop = THREE.LoopRepeat; idleAction.play(); }
    if (walkClip) { walkAction = mixer.clipAction(walkClip); walkAction.loop = THREE.LoopRepeat; }
    if (runClip) { runAction = mixer.clipAction(runClip); runAction.loop = THREE.LoopRepeat; }
  }).catch((err) => console.warn('Deer GLB failed:', err));

  const cfg = SETTINGS.animal.deer;
  let wanderTimer = Math.random() * 3;
  let wanderDir = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
  let runTimer = 0;
  const spawnPos = new THREE.Vector3(position.x, 0, position.z);

  function setAnim(type) {
    if (!mixer) return;
    const stop = (a) => { if (a && a.isRunning()) a.fadeOut(0.3); };
    const play = (a) => { if (a) a.reset().fadeIn(0.3).play(); };
    if (type === 'run') { stop(idleAction); stop(walkAction); play(runAction || walkAction); }
    else if (type === 'walk') { stop(idleAction); stop(runAction); play(walkAction || idleAction); }
    else { stop(walkAction); stop(runAction); play(idleAction); }
  }

  function update(dt, world) {
    if (mixer) mixer.update(dt);
    let flee = false;
    if (world && world.units) {
      world.units.forEach((u) => {
        const dx = group.position.x - u.group.position.x;
        const dz = group.position.z - u.group.position.z;
        if (Math.sqrt(dx*dx + dz*dz) < 10) { wanderDir.set(dx, 0, dz).normalize(); flee = true; }
      });
    }
    if (flee) { if (!isRunning) { isRunning = true; setAnim('run'); } runTimer = 3; }
    else if (runTimer > 0) { runTimer -= dt; if (runTimer <= 0) { isRunning = false; setAnim('walk'); } }

    wanderTimer -= dt;
    if (wanderTimer <= 0 && !flee) {
      wanderTimer = 3 + Math.random()*5;
      wanderDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
      if (group.position.distanceTo(spawnPos) > cfg.wanderRange) wanderDir.subVectors(spawnPos, group.position).normalize();
      if (!isRunning) setAnim('walk');
    }
    const spd = isRunning ? cfg.wanderSpeed : cfg.wanderSpeed*0.25;
    group.position.x += wanderDir.x*spd*dt;
    group.position.z += wanderDir.z*spd*dt;
    group.rotation.y = Math.atan2(wanderDir.x, wanderDir.z);
  }

  return {
    group, type: 'deer', position: () => group.position.clone(),
    state: () => 'wandering', isDepleted: () => false, canKill: false, update
  };
}