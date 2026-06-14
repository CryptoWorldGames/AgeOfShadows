import * as THREE from 'three';
import { SETTINGS } from './Settings.js';

export function createStone(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  scene.add(group);

  const scale = 0.8 + Math.random() * 0.6;
  group.scale.setScalar(scale);
  group.rotation.y = Math.random() * Math.PI * 2;

  // Main rock cluster
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.55 + Math.random() * 0.1, 0.52 + Math.random() * 0.1, 0.50),
    roughness: 0.95, metalness: 0.05, flatShading: true
  });

  const rocks = [];

  // Main large rock
  const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), rockMat);
  main.position.y = 0.5;
  main.scale.set(1, 0.75, 0.9);
  main.rotation.set(Math.random(), Math.random(), Math.random());
  main.castShadow = true; main.receiveShadow = true;
  group.add(main); rocks.push(main);

  // Medium rock
  const mid = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 1), rockMat);
  mid.position.set(0.7, 0.3, 0.2);
  mid.scale.set(0.9, 0.7, 0.8);
  mid.rotation.set(Math.random(), Math.random(), Math.random());
  mid.castShadow = true; mid.receiveShadow = true;
  group.add(mid); rocks.push(mid);

  // Small rock
  const small = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), rockMat);
  small.position.set(-0.55, 0.15, 0.4);
  small.rotation.set(Math.random(), Math.random(), Math.random());
  small.castShadow = true; small.receiveShadow = true;
  group.add(small); rocks.push(small);

  // Tiny accent rock
  const tiny = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 1), rockMat);
  tiny.position.set(0.3, 0.1, -0.6);
  tiny.rotation.set(Math.random(), Math.random(), Math.random());
  tiny.castShadow = true;
  group.add(tiny); rocks.push(tiny);

  // Stone pile (shown after mined out)
  const pileMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 1.0, flatShading: true });
  const pile = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const chunk = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.1, 0), pileMat
    );
    chunk.position.set(
      (Math.random() - 0.5) * 0.6, 0.1, (Math.random() - 0.5) * 0.6
    );
    chunk.rotation.set(Math.random(), Math.random(), Math.random());
    chunk.castShadow = true;
    pile.add(chunk);
  }
  pile.visible = false;
  group.add(pile);

  // Shadow blob
  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.01;
  group.add(shadowBlob);

  const S = SETTINGS.stone;
  let hp = S.hitsToKill;
  let stone = S.yield;
  let state = 'standing'; // standing | breaking | pile | respawning
  let respawnTimer = 0;
  let sinkT = 0;
  let hitFlashT = 0;

  function takeDamage(d) {
    if (state !== 'standing') return;
    hp -= d;
    // Flash white on hit
    hitFlashT = 0.1;
    rocks.forEach((r) => { r.material = r.material.clone(); r.material.emissive.setHex(0x444444); });
    // Shake
    group.rotation.z = (Math.random() - 0.5) * 0.05;
    if (hp <= 0) { hp = 0; state = 'breaking'; sinkT = 0; }
  }

  function reset() {
    hp = S.hitsToKill; stone = S.yield; state = 'standing';
    respawnTimer = 0; sinkT = 0;
    group.position.y = 0; group.visible = true;
    pile.visible = false; pile.scale.setScalar(1);
    rocks.forEach((r) => {
      r.material.transparent = false; r.material.opacity = 1;
      r.material.emissive.setHex(0x000000);
    });
  }

  function update(dt) {
    if (hitFlashT > 0) {
      hitFlashT -= dt;
      if (hitFlashT <= 0) {
        rocks.forEach((r) => { r.material.emissive.setHex(0x000000); });
        group.rotation.z = 0;
      }
    }

    if (state === 'breaking') {
      sinkT += dt;
      const f = Math.min(1, sinkT / 0.8);
      group.position.y = -f * 0.5;
      rocks.forEach((r) => { r.material.transparent = true; r.material.opacity = 1 - f; });
      if (f >= 1) {
        group.position.y = 0;
        rocks.forEach((r) => { r.material.opacity = 0; });
        pile.visible = true;
        state = 'pile';
      }
    } else if (state === 'respawning') {
      respawnTimer += dt;
      if (respawnTimer >= S.respawnTime) reset();
    }
  }

  return {
    group, type: 'stone',
    position: () => group.position.clone(),
    state: () => state,
    stoneRemaining: () => stone,
    isDepleted: () => state === 'respawning',
    takeDamage,
    takeStone(n) {
      const give = Math.min(n, stone);
      stone -= give;
      const frac = Math.max(0.05, stone / S.yield);
      pile.scale.setScalar(frac);
      if (stone <= 0) { state = 'respawning'; pile.visible = false; }
      return give;
    },
    update
  };
}