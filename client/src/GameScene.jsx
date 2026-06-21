import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { io } from 'socket.io-client';
import { createEnvironment } from './modules/Environment';
import { createHuman } from './modules/Human';
import { createTree } from './modules/Tree';
import { createUI, showChatPanel, showInventoryModal, showHouseModal, showBuildMenu, showToast, updateBuildProgressDisplay } from './modules/UI';
import { createControls } from './modules/Controls.jsx';
import { createTownCenter, createHouse, createFence } from './modules/Building';
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
      socket.emit('join', { userId: auth.userId, email: auth.email, displayName: auth.displayName || auth.email?.split('@')[0] || 'Player' });
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

      // AUDIT FIX #6: Proper event handling - canvas captures game controls
      // Disable browser context menu so right-click works for game (tree selection)
      renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

      // Keep pointer-events enabled so game gets all clicks
      // Buttons use stopPropagation() to prevent bubbling to canvas

      const env = createEnvironment(scene);
      const displayName = auth.displayName || 'Player';
      sessionStorage.setItem('playerName', displayName);
      sessionStorage.setItem('displayName', displayName);
      sessionStorage.setItem('userEmail', auth.email);
      const ui = createUI(displayName, null, displayName);
      showChatPanel(socket);

      // AUDIT FIX #2: Title z-index was below gameInfo box
      // Title must be on top of ALL UI elements (except modals)
      // Title at very top center, above resource bar
      const titlePanel = document.createElement('div');
      titlePanel.id = 'title-panel';
      titlePanel.style.cssText = `position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:500;font-family:'Segoe UI',sans-serif;text-align:center;pointer-events:none;white-space:nowrap;`;
      titlePanel.innerHTML = `<div style="color:#c8a84b;font-weight:700;font-size:20px;letter-spacing:2px;text-shadow:0 0 12px rgba(200,168,75,0.7);">⚔️ AGE OF SHADOWS ⚔️ <span style="font-size:10px;opacity:0.6;">v2.14</span></div>`;
      document.body.appendChild(titlePanel);

      // AUDIT FIX #5: Add online players list from database
      const onlinePlayersPanel = document.createElement('div');
      onlinePlayersPanel.id = 'online-players-panel';
      // Online players panel goes below the music tab (music tab is at top:110px)
      // Position it below music panel to avoid overlapping
      onlinePlayersPanel.style.cssText = `position:fixed;top:200px;right:14px;background:rgba(0,0,0,0.7);border:1px solid rgba(100,200,100,0.4);border-radius:8px;padding:10px 14px;color:#fff;font-family:'Segoe UI',sans-serif;font-size:11px;z-index:200;backdrop-filter:blur(4px);min-width:140px;max-width:200px;pointer-events:none;`;
      onlinePlayersPanel.innerHTML = `<div style="color:#7fc97f;font-weight:600;margin-bottom:6px;font-size:10px;">👥 ONLINE PLAYERS</div><div id="players-list" style="font-size:10px;line-height:1.6;color:#9f9;"></div>`;
      document.body.appendChild(onlinePlayersPanel);

      // Listen for online players updates from server
      socket.on('onlinePlayers', (players) => {
        const playersList = document.getElementById('players-list');
        if (playersList && Array.isArray(players)) {
          playersList.innerHTML = players.map(p => `<div>🔷 ${p.name || 'Player'}</div>`).join('') || '<div style="opacity:0.5;">None online</div>';
        }
      });

      const resources = joinData.player.resources || { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };
      const townCenterBuilding = joinData.world.buildings?.find(b => b.buildingType === 'townCenter');
      const townCenterStorage = townCenterBuilding?.storage || { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };

      const world = {
        camera, socket, playerId: joinData.playerId,
        units: [], trees: [], buildings: [], animals: [],
        stones: [], golds: [], resources, ui, pondPosition: env.pondPosition,
        serverDriven: true   // workers are simulated on the server; client just renders them
      };

      // Set up global game actions for button clicks
      // townCenterStorage is updated live via worldUpdate; resources = player's bank
      window.gameState = { resources: world.resources, townCenterStorage: world.resources };
      window.gameActions = {
        openInventory: () => {
          console.log('[OPEN INVENTORY]', window.gameState.resources, window.gameState.townCenterStorage);
          showInventoryModal(window.gameState.resources, window.gameState.townCenterStorage);
        },
        logout: () => {
          if (confirm('Logout?')) {
            socket.emit('resourceSync', { resources: world.resources });
            setTimeout(() => {
              localStorage.removeItem('auth');
              sessionStorage.removeItem('adminToken');
              window.location.href = '/';
            }, 1000);
          }
        }
      };

      // Use event delegation on document for buttons that might be recreated
      const delegatedClickHandler = (e) => {
        console.log('[BUTTON CLICK]', e.target, e.target.closest('button'));
        const btn = e.target.closest('button');
        if (!btn) return;
        console.log('[BUTTON HIT]', btn.textContent);
        e.preventDefault();
        e.stopImmediatePropagation();

        if (btn.textContent.includes('📦') || btn.textContent.includes('Inventory')) {
          console.log('[OPENING INVENTORY]');
          window.gameActions.openInventory();
        } else if (btn.textContent.includes('Logout')) {
          console.log('[LOGOUT]');
          window.gameActions.logout();
        }
      };
      document.addEventListener('click', delegatedClickHandler, { useCapture: true });

      // Keyboard shortcut for inventory - ONLY when not typing in a text field
      document.addEventListener('keydown', (e) => {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return; // never steal keys from chat
        if (e.key === 'i' || e.key === 'I') window.gameActions.openInventory();
      });

      // Note: the build menu (hammer button) and its selection callback are
      // wired up inside createControls via world.ui.onBuildSelect().

      if (joinData.player.units && joinData.player.units.length > 0) {
        joinData.player.units.forEach(u => {
          const human = createHuman(scene, { x: u.x, y: 0, z: u.z }, { team: u.team || 'red' });
          human.serverId = u.id;   // remember the server unit id so we can sync his position
          world.units.push(human);
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
      // SHARED WORLD: render the SERVER's trees (same for every player) instead of
      // a private random forest. The server owns their state; we just reflect it.
      const serverTrees = (joinData.world && joinData.world.trees) || [];
      serverTrees.forEach(st => {
        const t = createTree(scene, { x: st.x, y:0, z: st.z });
        t.id = st.id;
        if (t.applyServer) t.applyServer(st);
        addSpot(st.x, st.z);
        world.trees.push(t);
      });

      let attempts = 0;
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

      // Safety ONLY: if a unit's restored position lands literally inside the Town
      // Center footprint (e.g. a brand-new spawn at the map origin), nudge it just
      // clear of the wall. We intentionally do NOT relocate units that are already
      // out in the world — their saved position must be respected so a refresh
      // resumes the worker where he was instead of teleporting him home.
      (() => {
        const tcPos = defaultTownCenter.position();
        const wall = (defaultTownCenter.radius || 6) * 0.75; // collision wall
        world.units.forEach((u, i) => {
          const p = u.group.position;
          const inside = Math.sqrt((p.x - tcPos.x) ** 2 + (p.z - tcPos.z) ** 2) < wall;
          if (inside) {
            const spread = (i - (world.units.length - 1) / 2) * 2.0; // line them up
            p.x = tcPos.x + spread;
            p.z = tcPos.z + wall + 3.0; // step out the front
          }
        });
      })();

      socket.on('resourceUpdate', (res) => {
        world.resources = res;
      });

      // Authoritative tree state from the server (chop/fall/woodpile/respawn),
      // shared by everyone — so you see other players' trees fall too.
      socket.on('treesUpdate', (arr) => {
        (arr || []).forEach(st => {
          const t = world.trees.find(x => x.id === st.id);
          if (t && t.applyServer) t.applyServer(st);
        });
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

      socket.on('unitSpawned', ({ unit }) => {
        if (!unit) return;
        const human = createHuman(scene, { x: unit.x, y: 0, z: unit.z }, { team: unit.team || 'red' });
        human.serverId = unit.id;
        world.units.push(human);
        showToast('👤 Worker spawned at town center!', 2000, 'success');
      });

      socket.on('worldUpdate', (data) => {
        if (!data.players) return;
        const me = data.players[world.playerId];
        if (me) {
          world.resources = me.resources;
          if (window.gameState) {
            window.gameState.resources = me.resources;
            window.gameState.townCenterStorage = me.resources; // same bank
          }
        }
        if (me && me.buildQueue) {
          updateBuildProgressDisplay(me.buildQueue);
        } else {
          updateBuildProgressDisplay([]);
        }
        if (me && me.units) {
          me.units.forEach(u => {
            let h = world.units.find(x => x.serverId === u.id);
            if (!h) {
              // Server knows about a unit the client doesn't have a visual for yet — create it
              h = createHuman(scene, { x: u.x, y: 0, z: u.z }, { team: u.team || 'red' });
              h.serverId = u.id;
              world.units.push(h);
            }
            if (h.setServerPos) {
              h.setServerPos(u.x, u.z);
              if (h.unit) {
                h.unit.chopping = u.chopping || false;
                h.unit.moving = u.moving || false;
              }
            }
          });
          // Remove client visuals for units the server no longer has
          const serverIds = new Set(me.units.map(u => u.id));
          for (let i = world.units.length - 1; i >= 0; i--) {
            const h = world.units[i];
            if (h.serverId && !serverIds.has(h.serverId)) {
              scene.remove(h.group);
              world.units.splice(i, 1);
            }
          }
          const countEl = document.getElementById('unit-total-count');
          if (countEl) countEl.textContent = `${me.units.length} men`;
        }
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

      // Resources are now the server-authoritative stockpile (the server saves them
      // periodically and on disconnect), so the client no longer pushes its local
      // total — that old sync clobbered the real stockpile and lost deposited wood.
      // Keep the stockpile fresh from the server instead.
      socket.on('depositResult', ({ stockpile }) => {
        if (stockpile) world.resources = stockpile;
      });

      // (Position is now owned by the server simulation — the client no longer
      // pushes unit positions, which would fight the authoritative worker.)

      let update = () => {}, dispose = () => {};
      try {
        // Focus the camera on the player's first man so he's centered and zoomed in.
        const firstUnit = world.units[0];
        const startPos = firstUnit ? firstUnit.group.position.clone() : new THREE.Vector3(0, 0, 18);
        const ctrl = createControls(camera, renderer, scene, world, startPos);
        update = ctrl.update; dispose = ctrl.dispose;

        // Character selection button handler: jump the camera to the player's
        // man at a comfortable distance and select him.
        ui.onCharacterClick(() => {
          if (world.units && world.units.length > 0 && ctrl.focusUnit) {
            ctrl.focusUnit(world.units[0]);
            world.ui.showToast('Selected your unit');
          }
        });
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
