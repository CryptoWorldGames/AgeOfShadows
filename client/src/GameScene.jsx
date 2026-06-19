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
import { startResponsiveUI } from './modules/Responsive.js';

export default function GameScene({ auth }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [checkingOrientation, setCheckingOrientation] = useState(true);

  console.log('[GameScene] Mounted with auth:', auth);

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

  useEffect(() => {
    if (checkingOrientation || !containerRef.current || !auth) return;

    const socket = io('/', { reconnection: true });

    let initialized = false;
    let worldRef = null;
    let gameCleanup = null;

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
      socket.emit('join', { userId: auth.userId, email: auth.email });
    });

    socket.on('joined', (data) => {
      console.log('Joined:', data);
      // Guard against reconnects: build the game ONCE. A reconnect gives us a new
      // socket id, so just refresh our identity (so we keep skipping our own
      // avatar in worldUpdate) instead of spawning a whole second game + units.
      if (initialized) {
        if (worldRef) worldRef.playerId = data.playerId;
        return;
      }
      initialized = true;
      worldRef = initializeGame(data);
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

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      let renderer;
      try {
        // MOBILE: Disable antialias to improve performance on iPhone
        renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
      } catch (e) {
        console.error('WebGL failed:', e);
        setError('WebGL not supported. Try a different browser.');
        return;
      }

      renderer.setSize(window.innerWidth, window.innerHeight);
      // MOBILE: Lower pixel ratio on mobile for better performance
      if (isMobile) {
        renderer.setPixelRatio(1);
      } else {
        renderer.setPixelRatio(window.devicePixelRatio);
      }

      renderer.shadowMap.enabled = true;
      // MOBILE: Use simpler shadow algorithm on iPhone
      renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFShadowMap;
      console.log('📍 Canvas appending to container...');
      // Remove any leftover canvas so we never stack two game views.
      while (containerRef.current.firstChild) containerRef.current.removeChild(containerRef.current.firstChild);
      containerRef.current.appendChild(renderer.domElement);

      const env = createEnvironment(scene);
      const playerName = auth.displayName || auth.email.split('@')[0];
      sessionStorage.setItem('playerName', playerName);
      const ui = createUI(playerName, null, playerName);
      showChatPanel(socket);

      // Add game info panel (version & title) - top left, with inventory below
      const gameInfo = document.createElement('div');
      gameInfo.id = 'game-info-panel';
      gameInfo.style.cssText = `position:absolute;top:14px;left:14px;background:rgba(0,0,0,0.7);border:1px solid rgba(200,168,75,0.4);border-radius:8px;padding:10px 14px;color:#fff;font-family:'Segoe UI',sans-serif;font-size:12px;z-index:100;backdrop-filter:blur(4px);min-width:130px;`;
      gameInfo.innerHTML = `
        <div style="color:#c8a84b;font-weight:700;font-size:13px;margin-bottom:2px;letter-spacing:1px;">AGE OF SHADOWS</div>
        <div style="opacity:0.7;font-size:10px;margin-bottom:8px;">v2.14</div>
        <button id="inv-btn-inline" style="width:100%;padding:5px;background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.5);border-radius:4px;color:#c8a84b;cursor:pointer;font-size:10px;font-weight:600;margin-bottom:5px;">📦 Inventory</button>
        <button id="game-logout-btn" style="width:100%;padding:5px;background:rgba(200,168,75,0.2);border:1px solid #c8a84b;border-radius:4px;color:#c8a84b;cursor:pointer;font-size:10px;font-weight:600;">Logout</button>
      `;
      document.body.appendChild(gameInfo);

      const resources = joinData.player.resources || { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };

      const world = {
        camera, socket, playerId: joinData.playerId,
        units: [], trees: [], buildings: [], animals: [],
        stones: [], golds: [], resources, ui, pondPosition: env.pondPosition
      };

      document.getElementById('inv-btn-inline').onclick = () => showInventoryModal(world.resources);

      document.getElementById('game-logout-btn').onclick = () => {
        if (confirm('Logout?')) {
          const logoutBtn = document.getElementById('game-logout-btn');
          logoutBtn.disabled = true;
          logoutBtn.textContent = 'Saving...';
          socket.emit('resourceSync', { resources: world.resources });
          setTimeout(() => {
            localStorage.removeItem('auth');
            sessionStorage.removeItem('adminToken');
            window.location.href = '/';
          }, 4000);
        }
      };

      if (joinData.player.units && joinData.player.units.length > 0) {
        joinData.player.units.forEach(u => {
          world.units.push(createHuman(scene, { x: u.x, y: 0, z: u.z }, { team: u.team || 'red' }));
        });
      } else {
        // Spawn clearly in front of Town Center, visible to camera looking from +Z at (0,20,28)
        world.units.push(createHuman(scene, { x: 0, y: 0, z: 18 }, { team: 'red' }));
      }

      const usedSpots = [];
      function isTooClose(x, z, minDist) { return usedSpots.some((s) => Math.sqrt((x-s.x)**2+(z-s.z)**2) < minDist); }
      function addSpot(x, z) { usedSpots.push({ x, z }); }
      const pondX = -35, pondZ = -30; // keep things out of the pond
      const inPond = (x, z) => Math.sqrt((x-pondX)**2 + (z-pondZ)**2) < 11;
      let attempts = 0;
      while (world.trees.length < 100 && attempts < 4000) {
        attempts++;
        const x = (Math.random()-0.5)*150; const z = (Math.random()-0.5)*150;
        if (Math.sqrt(x*x+z*z) < 12) continue;
        if (inPond(x, z)) continue;
        if (isTooClose(x, z, 4)) continue;
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

      // Spread 30 chickens and 20 deer evenly across the whole map,
      // avoiding the town center and the pond.
      function scatterAnimal(makeFn, count, minCenter) {
        let placed = 0, tries = 0;
        while (placed < count && tries < count * 60) {
          tries++;
          const x = (Math.random()-0.5)*150;
          const z = (Math.random()-0.5)*150;
          if (Math.sqrt(x*x+z*z) < minCenter) continue; // off town center
          if (inPond(x, z)) continue;                    // not in the pond
          world.animals.push(makeFn(scene, { x, y:0, z }));
          placed++;
        }
      }
      scatterAnimal(createChicken, 30, 9);
      scatterAnimal(createDeer, 20, 12);

      // Create default Town Center at center of map
      const defaultTownCenter = createTownCenter(scene, false);
      defaultTownCenter.setPosition(0, 0);
      defaultTownCenter.place();
      defaultTownCenter.id = 'town-center-default';
      defaultTownCenter.type = 'townCenter';
      defaultTownCenter.storage = { wood: 0, stone: 0, gold: 0, food: 0, water: 0 };
      defaultTownCenter.storageMax = 100000;
      defaultTownCenter.ownerId = 'server';
      world.buildings.push(defaultTownCenter);

      // Safety: shove any unit that spawned inside the Town Center footprint out
      // to the edge so it's visible and tap-selectable (not buried in the wall).
      (() => {
        const tcPos = defaultTownCenter.position();
        const wall = (defaultTownCenter.radius || 6) * 0.75; // collision wall
        const clearDist = wall + 1.5; // stand this far from center
        world.units.forEach((u) => {
          const p = u.group.position;
          let dx = p.x - tcPos.x, dz = p.z - tcPos.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < clearDist) {
            if (d < 1e-4) { dx = 0; dz = 1; }
            else { dx /= d; dz /= d; }
            p.x = tcPos.x + dx * clearDist;
            p.z = tcPos.z + dz * clearDist;
          }
        });
      })();

      socket.on('resourceUpdate', (res) => {
        world.resources = res;
      });

      socket.on('treeUpdate', (tree) => {
        const t = world.trees.find(x => x.id === tree.id);
        if (t) { t.hp = tree.hp; t.wood = tree.wood; t.state = tree.state; }
      });

      socket.on('buildingPlaced', (building) => {
        // We already render our own buildings locally as real meshes; only add
        // OTHER players' buildings (and skip the meshless self-echo from the server).
        if (building.ownerId && building.ownerId === world.playerId) return;
        world.buildings.push(building);
      });

      // Other players: render and update their units
      const otherPlayers = {};

      function addOtherPlayer(playerId, player) {
        if (playerId === world.playerId || otherPlayers[playerId]) return;
        const units = [];
        (player.units || []).forEach(u => {
          const human = createHuman(scene, { x: u.x, y: 0, z: u.z }, { team: u.team || 'blue' });
          units.push(human);
        });
        otherPlayers[playerId] = units;
      }

      function removeOtherPlayer(playerId) {
        if (!otherPlayers[playerId]) return;
        otherPlayers[playerId].forEach(u => scene.remove(u.group));
        delete otherPlayers[playerId];
      }

      socket.on('playerJoined', ({ playerId, player }) => {
        addOtherPlayer(playerId, player);
      });

      socket.on('playerLeft', ({ playerId }) => {
        removeOtherPlayer(playerId);
      });

      socket.on('worldUpdate', (data) => {
        if (!data.players) return;
        Object.entries(data.players).forEach(([pId, player]) => {
          if (pId === world.playerId) return;
          if (!otherPlayers[pId]) {
            addOtherPlayer(pId, player);
          } else {
            (player.units || []).forEach((u, i) => {
              const mesh = otherPlayers[pId][i];
              if (mesh) mesh.group.position.set(u.x, 0, u.z);
            });
          }
        });
        // Remove players that left
        Object.keys(otherPlayers).forEach(pId => {
          if (!data.players[pId]) removeOtherPlayer(pId);
        });
      });

      const syncInterval = setInterval(() => {
        socket.emit('resourceSync', { resources: world.resources });
        console.log('[AUTOSAVE] Syncing resources:', world.resources);
      }, 5000);

      let update = () => {}, dispose = () => {};
      try {
        // Focus the camera on the player's first man so he's centered and zoomed in.
        const firstUnit = world.units[0];
        const startPos = firstUnit ? firstUnit.group.position.clone() : new THREE.Vector3(0, 0, 18);
        const ctrl = createControls(camera, renderer, scene, world, startPos);
        update = ctrl.update; dispose = ctrl.dispose;
      } catch (e) {
        console.error('createControls failed:', e);
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;top:90px;left:8px;right:8px;z-index:99999;background:rgba(150,0,0,0.95);color:#fff;font:12px monospace;padding:10px;border-radius:6px;white-space:pre-wrap;';
        box.textContent = '⚠ createControls failed:\n' + (e && e.message ? e.message : String(e)) + '\n' + (e && e.stack ? e.stack.split('\n').slice(0,4).join('\n') : '');
        document.body.appendChild(box);
      }
      let last = performance.now(); let time = 0;
      let loopErrorShown = false;
      const showLoopError = (label, err) => {
        if (loopErrorShown) return;
        loopErrorShown = true;
        console.error('Game loop error in ' + label + ':', err);
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;top:90px;left:8px;right:8px;z-index:99999;background:rgba(150,0,0,0.95);color:#fff;font:12px monospace;padding:10px;border-radius:6px;white-space:pre-wrap;';
        box.textContent = '⚠ Game error in ' + label + ':\n' + (err && err.message ? err.message : String(err)) + '\n' + (err && err.stack ? err.stack.split('\n').slice(0,4).join('\n') : '');
        document.body.appendChild(box);
      };
      // Run one game-logic step, isolating each subsystem so a single failure
      // never blocks the renderer (which is why the screen went fully black).
      const safe = (label, fn) => { try { fn(); } catch (e) { showLoopError(label, e); } };
      const animate = () => {
        requestAnimationFrame(animate);
        const now = performance.now(); let dt = (now-last)/1000; last = now;
        if (dt > 0.1) dt = 0.1; time += dt;

        safe('controls', () => update(time, dt));

        // Apply camera boundary limits
        const MAX_HEIGHT = 60;
        const MIN_HEIGHT = 5;
        const MAP_RADIUS = 65;
        if (camera.position.y > MAX_HEIGHT) camera.position.y = MAX_HEIGHT;
        if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;
        const dist = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
        if (dist > MAP_RADIUS) {
          const angle = Math.atan2(camera.position.z, camera.position.x);
          camera.position.x = Math.cos(angle) * MAP_RADIUS;
          camera.position.z = Math.sin(angle) * MAP_RADIUS;
        }

        safe('water', () => { if (env.waterUpdate) env.waterUpdate(dt); });
        safe('trees', () => world.trees.forEach((t) => t.update(dt)));
        safe('stones', () => world.stones.forEach((s) => s.update(dt)));
        safe('golds', () => world.golds.forEach((g) => g.update(dt)));
        safe('animals', () => world.animals.forEach((a) => a.update(dt, world)));
        safe('units', () => world.units.forEach((u) => { u.update(dt, world); u.animate(dt); }));
        safe('others', () => Object.values(otherPlayers).forEach(units => units.forEach(u => u.animate(dt))));
        safe('hud', () => ui.setResources(world.resources));

        // ALWAYS render — even if game logic above failed, the world stays visible.
        renderer.render(scene, camera);
      };
      console.log('🎬 Starting animation loop...');
      const responsiveObserver = startResponsiveUI();
      animate();
      console.log('✅ Game initialized successfully');

      const handleResize = () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

      gameCleanup = () => {
        clearInterval(syncInterval);
        Object.keys(otherPlayers).forEach(removeOtherPlayer);
        window.removeEventListener('resize', handleResize);
        dispose();
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
      return world;
    }

    return () => {
      if (gameCleanup) gameCleanup();
      socket.disconnect();
    };
  }, [auth, checkingOrientation]);

  if (checkingOrientation) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8a84b', fontSize: '16px' }}>
        Loading...
      </div>
    );
  }

  if (!auth) {
    return (
      <div style={{ width: '100%', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8a84b', fontSize: '16px', textAlign: 'center', padding: '20px' }}>
        <div>Not authenticated. Please log in.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{width:'100%',height:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'20px'}}>
        Error: {error}
      </div>
    );
  }

  const toggleOrientation = async () => {
    const goLandscape = isPortrait;
    try {
      // Orientation lock requires fullscreen on most mobile browsers.
      if (goLandscape && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock(goLandscape ? 'landscape' : 'portrait');
      } else {
        alert('Your phone blocks auto-rotate. Please use your phone’s rotation toggle.');
      }
      if (!goLandscape && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      alert('Rotation locked by phone settings. Enable auto-rotate, then try again.');
    }
  };

  return (
    <>
      <div ref={containerRef} style={{ width:'100%', height:'100vh', overflow:'hidden' }} />
      {isMobile && (
        <button onClick={toggleOrientation} style={{
          position:'fixed', top:'8px', right:'8px', zIndex:10000,
          background:'rgba(10,10,10,0.92)', border:'2px solid #c8a84b', borderRadius:'6px',
          color:'#c8a84b', fontFamily:"'Georgia',serif", padding:'6px 12px',
          fontSize:'12px', fontWeight:700, cursor:'pointer', display:'flex',
          alignItems:'center', gap:'6px', boxShadow:'0 2px 10px rgba(0,0,0,0.5)',
          pointerEvents:'auto'
        }}>
          <span style={{ fontSize:'14px' }}>🔄</span>
          {isPortrait ? 'Landscape' : 'Portrait'}
        </button>
      )}
    </>
  );
}
