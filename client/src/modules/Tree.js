import * as THREE from 'three';
import { SETTINGS } from './Settings.js';

export function createTree(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  scene.add(group);

  const pivot = new THREE.Group();
  group.add(pivot);

  // Random variation per tree
  const scale = 0.7 + Math.random() * 0.8;
  const rotY = Math.random() * Math.PI * 2;
  const lean = (Math.random() - 0.5) * 0.04;
  pivot.scale.setScalar(scale);
  pivot.rotation.y = rotY;
  pivot.rotation.z = lean;

  // Trunk — dark tapered bark
  const trunkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.22, 0.14, 0.08),
    roughness: 1.0, flatShading: true
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.22, 2.2, 6, 1),
    trunkMat
  );
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  pivot.add(trunk);

  // Pine layers — stacked flat cones, slightly offset for organic look
  const layerData = [
    { y: 1.8, r: 1.6, h: 1.4, ox: 0,    oz: 0 },
    { y: 2.8, r: 1.3, h: 1.3, ox: 0.05, oz: -0.05 },
    { y: 3.7, r: 1.0, h: 1.2, ox: -0.05,oz: 0.05 },
    { y: 4.5, r: 0.75,h: 1.1, ox: 0.03, oz: 0.03 },
    { y: 5.2, r: 0.5, h: 1.0, ox: -0.03,oz: -0.02 },
    { y: 5.8, r: 0.3, h: 0.8, ox: 0,    oz: 0 },
  ];

  // Slightly varied greens per tree
  const baseG = 0.35 + Math.random() * 0.15;
  const leafColors = [
    new THREE.Color(0.06, baseG, 0.08),
    new THREE.Color(0.08, baseG + 0.05, 0.10),
    new THREE.Color(0.05, baseG - 0.05, 0.07),
  ];

  const canopyMeshes = [];
  layerData.forEach((d, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: leafColors[i % leafColors.length],
      roughness: 0.95, metalness: 0,
      flatShading: true
    });
    // Use cone with low segments for angular, non-Minecraft look
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(d.r, d.h, 7, 1),
      mat
    );
    cone.position.set(d.ox, d.y, d.oz);
    cone.castShadow = true;
    cone.receiveShadow = true;
    pivot.add(cone);
    canopyMeshes.push(cone);
  });

  // Soft shadow blob at base
  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 12),
    new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true,
      opacity: 0.15, depthWrite: false
    })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.01;
  pivot.add(shadowBlob);

  // Wood pile (hidden until felled)
  const pileMat = new THREE.MeshStandardMaterial({
    color: 0x7a4a20, roughness: 0.95, flatShading: true
  });
  const pile = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.6, 6),
      pileMat
    );
    log.position.set(
      (Math.random() - 0.5) * 0.7,
      0.07 + Math.floor(i / 3) * 0.16,
      (Math.random() - 0.5) * 0.7
    );
    log.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0);
    log.castShadow = true;
    pile.add(log);
  }
  pile.visible = false;
  group.add(pile);

  let hp = 10;
  let wood = 10;
  let state = 'standing';
  let fallAngle = 0;
  let sinkT = 0;
  let respawnTimer = 0;

  function takeDamage(d) {
    if (state !== 'standing') return;
    hp -= d;
    pivot.rotation.z = lean + (Math.random() - 0.5) * 0.06;
    if (hp <= 0) { hp = 0; state = 'falling'; }
  }

  function reset() {
    hp = 10; wood = 10; state = 'standing';
    fallAngle = 0; sinkT = 0; respawnTimer = 0;
    pivot.rotation.x = 0; pivot.rotation.z = lean;
    pivot.position.y = 0; pivot.visible = true;
    pile.visible = false; pile.scale.setScalar(1);
    canopyMeshes.forEach((m) => {
      m.material.transparent = false; m.material.opacity = 1;
    });
    trunkMat.transparent = false; trunkMat.opacity = 1;
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
      canopyMeshes.forEach((m) => {
        m.material.transparent = true;
        m.material.opacity = 1 - f;
      });
      trunkMat.transparent = true;
      trunkMat.opacity = 1 - f;
      if (f >= 1) {
        pivot.visible = false;
        pile.visible = true;
        state = 'woodpile';
      }
    } else if (state === 'respawning') {
      if (serverMode) return;   // server decides when it grows back
      respawnTimer += dt;
      if (respawnTimer >= (SETTINGS.tree.respawnTime || 900)) reset();
    }
  }

  // When the server owns the trees, the client reflects authoritative state.
  let serverMode = false;
  function applyServer(s) {
    serverMode = true;
    if (typeof s.wood === 'number') { wood = s.wood; pile.scale.setScalar(Math.max(0.05, wood / 10)); }
    if (typeof s.hp === 'number') hp = s.hp;
    if (s.state && s.state !== state) {
      if (s.state === 'falling') {
        if (state === 'standing') state = 'falling'; // play the fall animation
      } else if (s.state === 'woodpile') {
        if (state === 'standing') {
          // Missed the 'falling' update — play fall animation before showing woodpile
          state = 'falling';
        } else if (state !== 'falling' && state !== 'sinking') {
          // Already past fall — jump straight to woodpile
          state = 'woodpile'; pivot.rotation.x = -Math.PI/2; pivot.visible = false; pile.visible = true;
        }
        // if falling/sinking, let update() finish the animation naturally → woodpile
      } else if (s.state === 'standing') { reset(); }
      else if (s.state === 'respawning') { state = 'respawning'; pile.visible = false; pivot.visible = false; }
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
    applyServer,
    update
  };

  return tree;
}