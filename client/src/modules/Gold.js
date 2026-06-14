import * as THREE from 'three';
import { SETTINGS } from './Settings.js';

export function createGold(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const scale = 0.5 + Math.random() * 0.4;
  group.scale.setScalar(scale);

  const oreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.35, 0.30, 0.22),
    roughness: 0.85, metalness: 0.1, flatShading: true
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(1.0, 0.78, 0.1),
    roughness: 0.3, metalness: 0.8, flatShading: true
  });

  const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), oreMat);
  main.position.y = 0.45; main.scale.set(1, 0.8, 0.9);
  main.rotation.set(Math.random(), Math.random(), Math.random());
  main.castShadow = true; main.receiveShadow = true; group.add(main);

  const mid = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), oreMat);
  mid.position.set(0.6, 0.25, 0.15); mid.scale.set(0.9, 0.7, 0.8);
  mid.rotation.set(Math.random(), Math.random(), Math.random());
  mid.castShadow = true; group.add(mid);

  const vein1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), goldMat);
  vein1.position.set(0.2, 0.75, 0.3);
  vein1.rotation.set(Math.random(), Math.random(), Math.random());
  vein1.castShadow = true; group.add(vein1);

  const vein2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 1), goldMat);
  vein2.position.set(-0.3, 0.55, -0.2);
  vein2.rotation.set(Math.random(), Math.random(), Math.random());
  vein2.castShadow = true; group.add(vein2);

  const vein3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 1), goldMat);
  vein3.position.set(0.5, 0.35, -0.3);
  vein3.rotation.set(Math.random(), Math.random(), Math.random());
  vein3.castShadow = true; group.add(vein3);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.2, 1.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 0.5; group.add(hitbox);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15, depthWrite: false })
  );
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.01; group.add(shadowBlob);

  const pile = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const nugget = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.06, 1), goldMat.clone());
    nugget.position.set((Math.random() - 0.5) * 0.4, 0.08, (Math.random() - 0.5) * 0.4);
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
  const allRocks = [main, mid];
  const allVeins = [vein1, vein2, vein3];

  function takeDamage(d) {
    if (state !== 'standing') return;
    hp -= d;
    hitFlashT = 0.12;
    allRocks.forEach((r) => { r.material = r.material.clone(); r.material.emissive.setHex(0x222200); });
    allVeins.forEach((v) => { v.material = v.material.clone(); v.material.emissive.setHex(0x886600); });
    group.rotation.z = (Math.random() - 0.5) * 0.07;
    if (hp <= 0) { hp = 0; state = 'breaking'; sinkT = 0; }
  }

  function reset() {
    hp = S.hitsToKill; gold = S.yield; state = 'standing';
    respawnTimer = 0; sinkT = 0;
    const angle = Math.random() * Math.PI * 2;
    const radius = 20 + Math.random() * 110;
    group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    group.visible = true; group.rotation.z = 0;
    pile.visible = false; pile.scale.setScalar(1);
    allRocks.forEach((r) => { r.material.transparent = false; r.material.opacity = 1; r.material.emissive.setHex(0x000000); });
    allVeins.forEach((v) => { v.material.transparent = false; v.material.opacity = 1; v.material.emissive.setHex(0x000000); });
  }

  function update(dt) {
    shimmerT += dt * 2;
    if (state === 'standing') {
      const shimmer = 0.08 + Math.sin(shimmerT) * 0.06;
      allVeins.forEach((v) => { v.material.emissive.setRGB(shimmer * 0.8, shimmer * 0.5, 0); });
    }
    if (hitFlashT > 0) {
      hitFlashT -= dt;
      if (hitFlashT <= 0) { allRocks.forEach((r) => { r.material.emissive.setHex(0x000000); }); group.rotation.z = 0; }
    }
    if (state === 'breaking') {
      sinkT += dt;
      const f = Math.min(1, sinkT / 0.8);
      group.position.y = -f * 0.5;
      allRocks.forEach((r) => { r.material.transparent = true; r.material.opacity = 1 - f; });
      allVeins.forEach((v) => { v.material.transparent = true; v.material.opacity = 1 - f; });
      if (f >= 1) {
        group.position.y = 0;
        allRocks.forEach((r) => { r.material.opacity = 0; });
        allVeins.forEach((v) => { v.material.opacity = 0; });
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