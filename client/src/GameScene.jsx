import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { io } from 'socket.io-client';
import { createEnvironment } from './modules/Environment';
import { createHuman } from './modules/Human';
import { createTree } from './modules/Tree';
import { createUI, showChatPanel, showInventoryModal, showHouseModal } from './modules/UI';
import { createControls } from './modules/Controls';
import { createTownCenter } from './modules/Building';
import { createChicken, createDeer } from './modules/Animal';
import { createStone } from './modules/Stone';
import { createGold } from './modules/Gold';

export default function GameScene({ auth }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [checkingOrientation, setCheckingOrientation] = useState(true);

  useEffect(() => {
    const checkOrientation = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const portrait = window.innerHeight > window.innerWidth;
      setIsMobile(mobile);
      setIsPortrait(portrait);
      setCheckingOrientation(false);
      console.log('Orientation check:', { mobile, portrait, height: window.innerHeight, width: window.innerWidth });
    };

    checkOrientation();

    let resizeTimeout;
    const debouncedCheck = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkOrientation, 100);
    };

    window.addEventListener('orientationchange', debouncedCheck);
    window.addEventListener('resize', debouncedCheck);

    return () => {
      window.removeEventListener('orientationchange', debouncedCheck);
      window.removeEventListener('resize', debouncedCheck);
      clearTimeout(resizeTimeout);
    };
  }, []);

  if (checkingOrientation) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8a84b', fontSize: '16px' }}>
        Loading...
      </div>
    );
  }

  if (isMobile && isPortrait) {
    const checkAndReload = () => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
          console.log('Auto-lock not supported, please rotate manually');
        });
      }
      setTimeout(() => window.location.reload(), 300);
    };
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', fontFamily: "'Segoe UI', sans-serif", textAlign: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <div onClick={checkAndReload} style={{ fontSize: '72px', marginBottom: '8px', animation: 'spin 2s linear infinite', cursor: 'pointer', opacity: 0.8 }}>↻</div>
        <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
        <h1 style={{ fontSize: 'clamp(22px,6vw,32px)', margin: '16px 0 12px', color: '#c8a84b', fontWeight: '900' }}>Turn Your Phone Sideways</h1>
        <p style={{ fontSize: 'clamp(13px,3.5vw,16px)', opacity: 0.7, maxWidth: '320px', lineHeight: '1.6', margin: '0 0 28px' }}>Rotate your device to landscape, then tap the arrow or button below</p>
        <button onClick={checkAndReload} style={{ padding: 'clamp(14px,4vw,18px) clamp(24px,8vw,40px)', background: 'linear-gradient(135deg, #c8a84b, #ffd700)', border: 'none', borderRadius: '10px', color: '#000', fontSize: 'clamp(14px,4vw,17px)', fontWeight: '700', cursor: 'pointer', letterSpacing: '1px', marginBottom: '12px', width: 'min(80vw, 300px)' }}>
          ✓ Rotated & Ready
        </button>
        <p style={{ fontSize: 'clamp(10px,2.5vw,12px)', opacity: 0.4, marginTop: '16px', color: '#c8a84b' }}>If auto-rotate is disabled, enable it in Settings</p>
      </div>
    );
  }

  useEffect(() => {
    if (!containerRef.current || !auth) return;

    const socket = io('/', { reconnection: true });

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
      socket.emit('join', { userId: auth.userId, email: auth.email });
    });

    socket.on('joined', (data) => {
      console.log('Joined:', data);
      initializeGame(data);
    });

    socket.on('joinError', (err) => {
      console.error('Join error:', err);
      setError(err.error || 'Failed to join');
    });

    function initializeGame(joinData) {
      console.log('🎮 Initializing game...');
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 20, 28);
      camera.lookAt(0, 0, 0);

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch (e) {
        console.error('WebGL failed:', e);
        setError('WebGL not supported. Try a different browser.');
        return;
      }

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      console.log('📍 Canvas appending to container...');
      containerRef.current.appendChild(renderer.domElement);

      const env = createEnvironment(scene);
      const ui = createUI(auth.displayName || auth.email, null, auth.displayName);
      showChatPanel(socket);

      // Add game info panel (version & title) - top left
      const gameInfo = document.createElement('div');
      gameInfo.style.cssText = `position:absolute;top:14px;left:14px;background:rgba(0,0,0,0.7);border:1px solid rgba(200,168,75,0.4);border-radius:8px;padding:12px 16px;color:#fff;font-family:'Segoe UI',sans-serif;font-size:12px;z-index:100;backdrop-filter:blur(4px);`;
      gameInfo.innerHTML = `
        <div style="color:#c8a84b;font-weight:700;font-size:14px;margin-bottom:4px;letter-spacing:1px;">AGE OF SHADOWS</div>
        <div style="opacity:0.7;font-size:11px;margin-bottom:8px;">v2.12</div>
        <button id="game-logout-btn" style="width:100%;padding:6px;background:rgba(200,168,75,0.2);border:1px solid #c8a84b;border-radius:4px;color:#c8a84b;cursor:pointer;font-size:10px;font-weight:600;">Logout</button>
      `;
      document.body.appendChild(gameInfo);

      document.getElementById('game-logout-btn').onclick = () => {
        if (confirm('Logout?')) {
          localStorage.removeItem('auth');
          sessionStorage.removeItem('adminToken');
          window.location.href = '/';
        }
      };

      const resources = joinData.player.resources || { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };

      const world = {
        camera, socket, playerId: joinData.playerId,
        units: [], trees: [], buildings: [], animals: [],
        stones: [], golds: [], resources, ui, pondPosition: env.pondPosition
      };

      // Add inventory button
      const invBtn = document.createElement('button');
      invBtn.style.cssText = `position:absolute;top:14px;left:80px;padding:10px 14px;background:rgba(200,168,75,0.2);border:1px solid #c8a84b;border-radius:6px;color:#c8a84b;cursor:pointer;font-weight:600;font-size:11px;font-family:'Segoe UI',sans-serif;z-index:100;`;
      invBtn.textContent = '📦 Inventory';
      invBtn.onclick = () => showInventoryModal(world.resources);
      document.body.appendChild(invBtn);

      if (joinData.player.units && joinData.player.units.length > 0) {
        joinData.player.units.forEach(u => {
          world.units.push(createHuman(scene, { x: u.x, y: 0, z: u.z }, { team: u.team || 'red' }));
        });
      } else {
        world.units.push(createHuman(scene, { x: 0, y: 0, z: 5 }, { team: 'red' }));
      }

      const usedSpots = [];
      function isTooClose(x, z, minDist) { return usedSpots.some((s) => Math.sqrt((x-s.x)**2+(z-s.z)**2) < minDist); }
      function addSpot(x, z) { usedSpots.push({ x, z }); }
      let attempts = 0;
      while (world.trees.length < 20 && attempts < 300) {
        attempts++;
        const x = (Math.random()-0.5)*120; const z = (Math.random()-0.5)*120;
        if (Math.sqrt(x*x+z*z) < 12) continue;
        if (isTooClose(x, z, 5)) continue;
        addSpot(x, z); world.trees.push(createTree(scene, { x, y:0, z }));
      }

      attempts = 0;
      while (world.stones.length < 8 && attempts < 300) {
        attempts++;
        const x = (Math.random()-0.5)*120; const z = (Math.random()-0.5)*120;
        if (Math.sqrt(x*x+z*z) < 15) continue;
        if (isTooClose(x, z, 8)) continue;
        addSpot(x, z); world.stones.push(createStone(scene, { x, y:0, z }));
      }

      attempts = 0;
      while (world.golds.length < 4 && attempts < 300) {
        attempts++;
        const angle = Math.random()*Math.PI*2;
        const r = 15 + Math.random()*30;
        const x = Math.cos(angle)*r; const z = Math.sin(angle)*r;
        if (isTooClose(x, z, 10)) continue;
        addSpot(x, z); world.golds.push(createGold(scene, { x, y:0, z }));
      }
      world.golds.push(createGold(scene, { x: 5, y:0, z: 5 }));

      world.animals.push(createChicken(scene, { x:6, y:0, z:6 }));
      world.animals.push(createChicken(scene, { x:-6, y:0, z:6 }));
      world.animals.push(createChicken(scene, { x:6, y:0, z:-6 }));
      world.animals.push(createChicken(scene, { x:-6, y:0, z:-6 }));
      world.animals.push(createChicken(scene, { x:0, y:0, z:8 }));
      world.animals.push(createDeer(scene, { x:5, y:0, z:-8 }));
      world.animals.push(createDeer(scene, { x:-5, y:0, z:-8 }));
      world.animals.push(createDeer(scene, { x:10, y:0, z:5 }));
      world.animals.push(createDeer(scene, { x:-10, y:0, z:5 }));

      socket.on('resourceUpdate', (res) => {
        world.resources = res;
      });

      socket.on('treeUpdate', (tree) => {
        const t = world.trees.find(x => x.id === tree.id);
        if (t) { t.hp = tree.hp; t.wood = tree.wood; t.state = tree.state; }
      });

      socket.on('buildingPlaced', (building) => {
        world.buildings.push(building);
      });

      const { update, dispose } = createControls(camera, renderer, scene, world);
      let last = performance.now(); let time = 0;
      const animate = () => {
        requestAnimationFrame(animate);
        const now = performance.now(); let dt = (now-last)/1000; last = now;
        if (dt > 0.1) dt = 0.1; time += dt;
        update(time, dt);

        // Apply camera boundary limits
        const MAX_HEIGHT = 60;
        const MIN_HEIGHT = 5;
        const MAP_RADIUS = 65;

        // Enforce height limits
        if (camera.position.y > MAX_HEIGHT) camera.position.y = MAX_HEIGHT;
        if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;

        // Enforce map radius (no going too far away)
        const dist = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
        if (dist > MAP_RADIUS) {
          const angle = Math.atan2(camera.position.z, camera.position.x);
          camera.position.x = Math.cos(angle) * MAP_RADIUS;
          camera.position.z = Math.sin(angle) * MAP_RADIUS;
        }

        if (env.waterUpdate) env.waterUpdate(dt);
        world.trees.forEach((t) => t.update(dt));
        world.stones.forEach((s) => s.update(dt));
        world.golds.forEach((g) => g.update(dt));
        world.animals.forEach((a) => a.update(dt, world));
        world.units.forEach((u) => { u.update(dt, world); u.animate(dt); });
        ui.setResources(world.resources);
        renderer.render(scene, camera);
      };
      console.log('🎬 Starting animation loop...');
      animate();
      console.log('✅ Game initialized successfully');

      const handleResize = () => {
        camera.aspect = window.innerWidth/window.innerHeight;
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
    }

    return () => {
      socket.disconnect();
    };
  }, [auth, showRotateScreen]);

  if (error) {
    return (
      <div style={{width:'100%',height:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'20px'}}>
        Error: {error}
      </div>
    );
  }

  return React.createElement('div', { ref: containerRef, style: { width:'100%', height:'100vh', overflow:'hidden' } });
}
