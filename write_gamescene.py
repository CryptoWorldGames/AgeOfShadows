content = """import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createEnvironment } from './modules/Environment';
import { createHuman } from './modules/Human';
import { createTree } from './modules/Tree';
import { createUI } from './modules/UI';
import { createControls } from './modules/Controls';
import { createTownCenter } from './modules/Building';
import { createChicken, createDeer } from './modules/Animal';
import { createStone } from './modules/Stone';
import { createGold } from './modules/Gold';
export default function GameScene({ playerId, gameState }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 25, 35);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    const env = createEnvironment(scene);
    const ui = createUI(playerId, gameState);
    const resources = { wood: 10000, food: 10000, water: 10000, gold: 10000, stone: 10000 };
    const world = {
      camera, units: [], trees: [], buildings: [],
      animals: [], stones: [], golds: [], resources, ui,
      pondPosition: env.pondPosition
    };
    world.units.push(createHuman(scene, { x: -8, y: 0, z: 8 }, { team: 'red' }));
    world.units.push(createHuman(scene, { x: 8, y: 0, z: 8 }, { team: 'blue' }));
    const usedSpots = [];
    function isTooClose(x, z, minDist) {
      return usedSpots.some((s) => Math.sqrt((x-s.x)**2 + (z-s.z)**2) < minDist);
    }
    function addSpot(x, z) { usedSpots.push({ x, z }); }
    let attempts = 0;
    while (world.trees.length < 20 && attempts < 300) {
      attempts++;
      const x = (Math.random() - 0.5) * 120;
      const z = (Math.random() - 0.5) * 120;
      if (Math.sqrt(x*x + z*z) < 12) continue;
      if (isTooClose(x, z, 5)) continue;
      addSpot(x, z);
      world.trees.push(createTree(scene, { x, y: 0, z }));
    }
    attempts = 0;
    while (world.stones.length < 8 && attempts < 300) {
      attempts++;
      const x = (Math.random() - 0.5) * 120;
      const z = (Math.random() - 0.5) * 120;
      if (Math.sqrt(x*x + z*z) < 15) continue;
      if (isTooClose(x, z, 8)) continue;
      addSpot(x, z);
      world.stones.push(createStone(scene, { x, y: 0, z }));
    }
    attempts = 0;
    while (world.golds.length < 4 && attempts < 300) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 90;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (isTooClose(x, z, 10)) continue;
      addSpot(x, z);
      world.golds.push(createGold(scene, { x, y: 0, z }));
    }
    const startTC = createTownCenter(scene, false);
    startTC.setPosition(0, 0);
    startTC.place();
    world.buildings.push(startTC);
    world.animals.push(createChicken(scene, { x: 6, y: 0, z: 6 }));
    world.animals.push(createChicken(scene, { x: -6, y: 0, z: 6 }));
    world.animals.push(createChicken(scene, { x: 6, y: 0, z: -6 }));
    world.animals.push(createChicken(scene, { x: -6, y: 0, z: -6 }));
    world.animals.push(createChicken(scene, { x: 0, y: 0, z: 8 }));
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const r = 35 + Math.random() * 15;
      world.animals.push(createDeer(scene, { x: Math.cos(ang) * r, y: 0, z: Math.sin(ang) * r }));
    }
    const { update, dispose } = createControls(camera, renderer, scene, world);
    let last = performance.now();
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      time += dt;
      update(time, dt);
      if (env.waterUpdate) env.waterUpdate(dt);
      world.trees.forEach((t) => t.update(dt));
      world.stones.forEach((s) => s.update(dt));
      world.golds.forEach((g) => g.update(dt));
      world.animals.forEach((a) => a.update(dt, world));
      world.units.forEach((u) => { u.update(dt, world); u.animate(dt); });
      ui.setResources(resources);
      renderer.render(scene, camera);
    };
    animate();
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [playerId]);
  return React.createElement('div', { ref: containerRef, style: { width: '100%', height: '100vh', overflow: 'hidden' } });
}"""
with open(r'C:\Users\mycry\games\AgeOfShadows\client\src\GameScene.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')