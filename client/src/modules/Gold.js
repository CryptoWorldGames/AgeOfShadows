import * as THREE from 'three';
import { SETTINGS } from './Settings.js';

export function createGold(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const scale = 0.5 + Math.random() * 0.4;
  group.scale.setScalar(scale);

  // All gold — shiny metallic yellow
  function makeGoldMat() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(1.0, 0.75, 0.05),
      roughness: 0.15,
      metalness: 0.95,
      flatShading: true,
      emissive: new THREE.Color(0.3, 0.2, 0.0),
      emissiveIntensity: 0.4
    });
  }

  const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 1), makeGoldMat());
  main.position.y = 0.5; main.scale.set(1, 0.8, 0.9);
  main.rotation.set(Math.random(), Math.random(), Math.random());
  main.castShadow = true; main.receiveShadow = true; group.add(main);

  const mid = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), makeGoldMat());
  mid.position.set(0.65, 0.28, 0.2); mid.scale.set(0.9, 0.75, 0.85);
  mid.rotation.set(Math.random(), Math.random(), Math.random());
  mid.castShadow = true; group.add(mid);

  const chunk1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), makeGoldMat());
  chunk1.position.set(-0.45, 0.22, 0.35);
  chunk1.rotation.set(Math.random(), Math.random(), Math.random());
  chunk1.castShadow = true; group.add(chunk1);

  const chunk2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 1), makeGoldMat());
  chunk2.position.set(0.3, 0.15, -0.5);
  chunk2.rotation.set(Math.random(), Math.random(), Math.random());
  chunk2.castShadow = true; group.add(chunk2);

  const chunk3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), makeGoldMat());
  chunk3.position.set(-0.2, 0.55, -0.3);
  chunk3.rotation.set(Math.random(), Math.random(), Math.random());
  chunk3.castShadow = true; group.add(chunk3);

  // Invisible hitbox
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.2, 1.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 0.5; group.add(hitbox);

  // Shadow
  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false })
  );
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.01; group.add(shadowBlob);

  // Gold nugget pile
  const pile = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const nugget = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.07, 1), makeGoldMat());
    nugget.position.set((Math.random()-0.5)*0.5, 0.08, (Math.random()-0.5)*0.5);
    nugget.rotation.set(Math.random(), Math.random(), Math.random());
    nugget.castShadow = true; pile.add(nugget);
  }
  pile.visible = false; group.add(pile);

  const S = SETTINGS.gold;
  let hp = S.hitsToKill;
  let gold = S.yield;
  let state = 'standing';
  let respawnTimer = 0;
  let sinkT = 0;
  let hitFlashT = 0;
  let shimmerT = Math.random() * Math.PI * 2;
  const allChunks = [main, mid, chunk1, chunk2, chunk3];

  function takeDamage(d) {
    if (state !== 'standing') return;
    hp -= d;
    hitFlashT = 0.12;
    allChunks.forEach((c) => { c.material.emissiveIntensity = 1.0; });
    group.rotation.z = (Math.random()-0.5) * 0.08;
    if (hp <= 0) { hp = 0; state = 'breaking'; sinkT = 0; }
  }

  function reset() {
    hp = S.hitsToKill; gold = S.yield; state = 'standing';
    respawnTimer = 0; sinkT = 0;
    const angle = Math.random() * Math.PI * 2;
    const radius = 20 + Math.random() * 110;
    group.position.set(Math.cos(angle)*radius, 0, Math.sin(angle)*radius);
    group.visible = true; group.rotation.z = 0;
    pile.visible = false; pile.scale.setScalar(1);
    allChunks.forEach((c) => { c.material.transparent = false; c.material.opacity = 1; c.material.emissiveIntensity = 0.4; });
  }

  function update(dt) {
    shimmerT += dt * 1.5;
    if (state === 'standing') {
      const shimmer = 0.4 + Math.sin(shimmerT) * 0.2;
      allChunks.forEach((c) => { c.material.emissiveIntensity = shimmer; });
    }
    if (hitFlashT > 0) {
      hitFlashT -= dt;
      if (hitFlashT <= 0) { allChunks.forEach((c) => { c.material.emissiveIntensity = 0.4; }); group.rotation.z = 0; }
    }
    if (state === 'breaking') {
      sinkT += dt;
      const f = Math.min(1, sinkT / 0.8);
      group.position.y = -f * 0.5;
      allChunks.forEach((c) => { c.material.transparent = true; c.material.opacity = 1 - f; });
      if (f >= 1) {
        group.position.y = 0;
        allChunks.forEach((c) => { c.material.opacity = 0; });
        pile.visible = true; state = 'pile';
      }
    } else if (state === 'respawning') {
      respawnTimer += dt;
      if (respawnTimer >= S.respawnTime) reset();
    }
  }

  return {
    group, type: 'gold',
    position: () => group.position.clone(),
    state: () => state,
    goldRemaining: () => gold,
    isDepleted: () => state === 'respawning',
    takeDamage,
    takeGold(n) {
      const give = Math.min(n, gold);
      gold -= give;
      const frac = Math.max(0.05, gold / S.yield);
      pile.scale.setScalar(frac);
      if (gold <= 0) { state = 'respawning'; pile.visible = false; }
      return give;
    },
    update
  };
}