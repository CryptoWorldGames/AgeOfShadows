import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
let loadPromise = null;

function getModel() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    loader.load(
      '/models/pine_trees_pack_lowpoly_game_ready_lods.glb',
      resolve,
      undefined,
      reject
    );
  });
  return loadPromise;
}

export function createTree(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  scene.add(group);

  const pivot = new THREE.Group();
  group.add(pivot);

  const scale = 0.8 + Math.random() * 0.7;
  const rotY = Math.random() * Math.PI * 2;
  pivot.scale.setScalar(scale);
  pivot.rotation.y = rotY;

  // Wood pile
  const pileMat = new THREE.MeshStandardMaterial({ color: 0x7a4a20, roughness: 0.95 });
  const pile = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.65, 6),
      pileMat
    );
    log.position.set(
      (Math.random() - 0.5) * 0.7,
      0.08 + Math.floor(i / 3) * 0.18,
      (Math.random() - 0.5) * 0.7
    );
    log.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0);
    log.castShadow = true;
    pile.add(log);
  }
  pile.visible = false;
  group.add(pile);

  let modelMeshes = [];

  getModel().then((gltf) => {
    const clone = gltf.scene.clone(true);
    clone.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        modelMeshes.push(c);
      }
    });
    pivot.add(clone);
  }).catch(() => {
    // Fallback cone tree if GLB fails
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2d6a2d })
    );
    cone.position.y = 4;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 2, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2b })
    );
    trunk.position.y = 1;
    pivot.add(cone); pivot.add(trunk);
    pivot.traverse((c) => { if (c.isMesh) modelMeshes.push(c); });
  });

  let hp = 10;
  let wood = 10;
  let state = 'standing';
  let fallAngle = 0;
  let sinkT = 0;
  let respawnTimer = 0;

  function takeDamage(d) {
    if (state !== 'standing') return;
    hp -= d;
    pivot.rotation.z = (Math.random() - 0.5) * 0.06;
    if (hp <= 0) { hp = 0; state = 'falling'; }
  }

  function reset() {
    hp = 10; wood = 10; state = 'standing';
    fallAngle = 0; sinkT = 0; respawnTimer = 0;
    pivot.rotation.x = 0; pivot.rotation.z = 0;
    pivot.position.y = 0; pivot.visible = true;
    pile.visible = false; pile.scale.setScalar(1);
    modelMeshes.forEach((m) => {
      if (m.material) { m.material.transparent = false; m.material.opacity = 1; }
    });
  }

  function update(dt) {
    if (state === 'falling') {
      fallAngle += dt * 0.85;
      pivot.rotation.x = -fallAngle;
      if (fallAngle >= Math.PI / 2) {
        pivot.rotation.x = -Math.PI / 2;
        state = 'sinking';
      }
    } else if (state === 'sinking') {
      sinkT += dt;
      const f = Math.min(1, sinkT / 1.2);
      pivot.position.y = -f * 2;
      modelMeshes.forEach((m) => {
        if (m.material) { m.material.transparent = true; m.material.opacity = 1 - f; }
      });
      if (f >= 1) {
        pivot.visible = false;
        pile.visible = true;
        state = 'woodpile';
      }
    } else if (state === 'respawning') {
      respawnTimer += dt;
      if (respawnTimer >= 60) reset();
    }
  }

  const tree = {
    group,
    type: 'tree',
    position: () => group.position.clone(),
    state: () => state,
    hp: () => hp,
    maxHp: 10,
    woodRemaining: () => wood,
    isDepleted: () => state === 'respawning',
    takeDamage,
    takeWood(n) {
      const give = Math.min(n, wood);
      wood -= give;
      const frac = Math.max(0.05, wood / 10);
      pile.scale.setScalar(frac);
      if (wood <= 0) { state = 'respawning'; pile.visible = false; }
      return give;
    },
    update
  };

  return tree;
}