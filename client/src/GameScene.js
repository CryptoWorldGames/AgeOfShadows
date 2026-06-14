import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createEnvironment } from './modules/Environment';
import { createHuman } from './modules/Human';
import { createTree } from './modules/Tree';
import { createUI } from './modules/UI';
import { createControls } from './modules/Controls';
export default function GameScene({ playerId, gameState }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 20);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    createEnvironment(scene);
    const ui = createUI(playerId, gameState);
    const resources = { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };
    const world = { camera, units: [], trees: [], buildings: [], resources, ui };
    world.units.push(createHuman(scene, { x: -2, y: 0, z: 0 }, { team: 'red' }));
    world.units.push(createHuman(scene, { x: 2, y: 0, z: 0 }, { team: 'blue' }));
    // 20 random trees, kept away from player spawn area
    const usedSpots = [];
    let attempts = 0;
    while (world.trees.length < 20 && attempts < 200) {
      attempts++;
      const x = (Math.random() - 0.5) * 120;
      const z = (Math.random() - 0.5) * 120;
      if (Math.sqrt(x*x + z*z) < 8) continue; // keep spawn area clear
      let tooClose = false;
      for (const s of usedSpots) {
        if (Math.sqrt((x-s.x)**2 + (z-s.z)**2) < 5) { tooClose = true; break; }
      }
      if (tooClose) continue;
      usedSpots.push({ x, z });
      world.trees.push(createTree(scene, { x, y: 0, z }));
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
      world.trees.forEach((t) => t.update(dt));
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
}