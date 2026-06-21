import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTownCenter, createHouse, createFence } from './Building.js';
import { showTownCenterModal, showToast } from './UI.js';
import { SETTINGS } from './Settings.js';

export function createControls(camera, renderer, scene, world, playerStartPos) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  controls.minDistance = isMobile ? 3 : 8;
  controls.maxDistance = 150;
  controls.enableZoom = true;
  if (isMobile) {
    // One finger drags to pan the map; two fingers pinch to zoom.
    // A one-finger TAP (no drag) is handled separately for select/command.
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  }
  controls.minPolarAngle = Math.PI / 6;
  controls.maxPolarAngle = Math.PI / 3;
  controls.zoomToCursor = false;
  controls.mouseButtons = { MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.enableRotate = false;
  // Start the camera south of (in front of) the player's man, looking north past
  // him toward the Town Center, so you see "the man standing in front of the
  // Town Center". We aim at a point just in front of the man and keep enough
  // distance that the camera never starts jammed inside the Town Center.
  if (playerStartPos) {
    const dist = isMobile ? 16 : 20;
    controls.target.set(playerStartPos.x, 1.2, playerStartPos.z - 2);
    camera.position.set(playerStartPos.x, dist * 0.65, playerStartPos.z + dist);
  } else {
    controls.target.set(0, 1.2, 0);
    camera.position.set(0, 14, 24);
  }
  controls.update();

  const okSound = new Audio('/sounds/pensieri_profondi_scuba-ok-274157.mp3');
  function playOk() {
    if (typeof window !== 'undefined' && window.__AOS_MUTED) return; // master mute
    try { okSound.currentTime = 0; okSound.play().catch(() => {}); } catch (e) {}
  }

  const markerGroup = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), new THREE.MeshPhongMaterial({ color: 0xff6600 }));
  cone.position.y = 1.5; cone.rotation.z = Math.PI; markerGroup.add(cone);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), new THREE.MeshPhongMaterial({ color: 0x8B4513 }));
  shaft.position.y = 2.4; markerGroup.add(shaft);
  markerGroup.visible = false; scene.add(markerGroup);

  const resHighlight = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.15, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff66, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  resHighlight.rotation.x = -Math.PI / 2; resHighlight.position.y = 0.04; resHighlight.visible = false;
  scene.add(resHighlight);
  let resHighlightTimer = 0;

  const rings = new Map();
  function ringFor(unit) {
    if (!rings.has(unit)) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 28),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
      );
      r.rotation.x = -Math.PI / 2; r.position.y = 0.05; r.visible = false;
      scene.add(r); rings.set(unit, r);
    }
    return rings.get(unit);
  }

  const selectionBox = document.createElement('div');
  selectionBox.style.cssText = 'position:fixed;border:2px solid #00ff00;background:rgba(0,255,0,0.1);pointer-events:none;display:none;z-index:999;';
  document.body.appendChild(selectionBox);

  const selected = new Set();
  let markerTimer = 0;
  let mouseDownPos = { x: 0, y: 0 };
  let isDragging = false;
  let ghostBuilding = null;
  let awaitingConfirm = false;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const getRect = () => renderer.domElement.getBoundingClientRect();
  const setMouseFromEvent = (cx, cy) => {
    const rect = getRect();
    mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((cy - rect.top) / rect.height) * 2 + 1;
  };
  const groundPoint = (cx, cy) => {
    setMouseFromEvent(cx, cy);
    raycaster.setFromCamera(mouse, camera);
    const p = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, p);
    return p;
  };

  function unitScreenPos(unit) {
    const rect = getRect();
    const p = unit.group.position.clone();
    let cy = 1.0; try { cy = unit.getModelCenterY(); } catch (e) {}
    p.y = cy; p.project(camera);
    return { x: (p.x + 1) / 2 * rect.width + rect.left, y: (-p.y + 1) / 2 * rect.height + rect.top };
  }

  function raycastGroup(cx, cy, items) {
    setMouseFromEvent(cx, cy);
    raycaster.setFromCamera(mouse, camera);
    for (const item of items) {
      if (item.isDepleted && item.isDepleted()) continue;
      if (item.state && (item.state() === 'meatpile' || item.state() === 'dying')) continue;
      const meshes = [];
      item.group.updateMatrixWorld(true);
      item.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
      if (raycaster.intersectObjects(meshes, true).length > 0) return item;
    }
    return null;
  }

  function raycastUnit(cx, cy) {
    setMouseFromEvent(cx, cy);
    raycaster.setFromCamera(mouse, camera);
    for (const unit of world.units) {
      const meshes = [];
      unit.group.updateMatrixWorld(true);
      unit.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
      if (raycaster.intersectObjects(meshes, true).length > 0) return unit;
    }
    return null;
  }

  function nearestUnit(cx, cy, radiusPx = 35) {
    let best = null, bestD = radiusPx;
    for (const unit of world.units) {
      const sp = unitScreenPos(unit);
      const d = Math.hypot(cx - sp.x, cy - sp.y);
      if (d <= bestD) { bestD = d; best = unit; }
    }
    return best;
  }

  function raycastBuilding(cx, cy) {
    setMouseFromEvent(cx, cy);
    raycaster.setFromCamera(mouse, camera);
    for (const building of (world.buildings || [])) {
      if (!building.group) continue;
      const meshes = [];
      building.group.updateMatrixWorld(true);
      building.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
      if (raycaster.intersectObjects(meshes, true).length > 0) return building;
    }
    return null;
  }

  function clearSelection() {
    selected.forEach((u) => { u.setSelected(false); ringFor(u).visible = false; });
    selected.clear(); world.ui.setSelectedCount(0);
  }
  function addToSelection(u) {
    selected.add(u); u.setSelected(true); ringFor(u).visible = true;
    world.ui.setSelectedCount(selected.size);
  }
  function showResourceHighlight(pos) {
    resHighlight.position.set(pos.x, 0.04, pos.z);
    resHighlight.visible = true; resHighlightTimer = 3.0;
  }

  // ---- Build system ----
  let currentBuildKind = null;   // 'house' | 'woodFence' | 'stoneFence'
  let fenceMode = false;         // fences place repeatedly without a confirm
  const constructing = [];       // buildings currently being built (timed)

  const makeGhost = (kind) => {
    if (kind === 'house') return createHouse(scene, true);
    if (kind === 'woodFence' || kind === 'stoneFence') return createFence(scene, kind, true);
    if (kind === 'townCenter') return createTownCenter(scene, true);
    return null;
  };
  const canAfford = (kind) => {
    const b = SETTINGS.building[kind]; if (!b) return false;
    return (world.resources.wood||0) >= (b.woodCost||0)
      && (world.resources.stone||0) >= (b.stoneCost||0)
      && (world.resources.gold||0) >= (b.goldCost||0);
  };
  const payFor = (kind) => {
    const b = SETTINGS.building[kind];
    world.resources.wood = (world.resources.wood||0) - (b.woodCost||0);
    world.resources.stone = (world.resources.stone||0) - (b.stoneCost||0);
    world.resources.gold = (world.resources.gold||0) - (b.goldCost||0);
  };
  const costLabel = (kind) => {
    const b = SETTINGS.building[kind]; const p = [];
    if (b.woodCost) p.push(`${b.woodCost} wood`);
    if (b.stoneCost) p.push(`${b.stoneCost} stone`);
    if (b.goldCost) p.push(`${b.goldCost} gold`);
    return p.join(', ');
  };
  const cancelBuild = () => {
    if (ghostBuilding) ghostBuilding.remove();
    ghostBuilding = null; currentBuildKind = null; fenceMode = false;
    awaitingConfirm = false; world.ui.hideConfirm();
  };
  // Commit a building at (x,z): deduct cost, start its construction timer.
  const commitBuild = (kind, x, z) => {
    if (!canAfford(kind)) { world.ui.showToast(`Need ${costLabel(kind)}`); return false; }
    payFor(kind);
    const b = ghostBuilding;
    b.setPosition(x, z);
    b.isGhost = false;                 // occupy the footprint (collision) while building
    b.id = `b_${world.playerId||'me'}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    b.ownerId = world.playerId;
    b.startConstruction(SETTINGS.building[kind].buildTime);
    world.buildings.push(b);
    constructing.push(b);
    world.socket.emit('placeBuilding', { type: kind, x, z });
    return true;
  };

  // Place one fence section and immediately ready the next one (chain building).
  const placeFenceSection = (x, z) => {
    const kind = currentBuildKind;
    if (!commitBuild(kind, x, z)) { cancelBuild(); return; }
    if (canAfford(kind)) {
      ghostBuilding = makeGhost(kind);
      ghostBuilding.setPosition(x, z);
    } else {
      ghostBuilding = null; currentBuildKind = null; fenceMode = false;
      world.ui.showToast('Out of resources for more fence.');
    }
  };

  world.ui.onBuildSelect((kind) => {
    cancelBuild();
    if (!canAfford(kind)) { world.ui.showToast(`Need ${costLabel(kind)} to build ${SETTINGS.building[kind].label}`); return; }

    // Special case: Man units spawn at town center, no placement needed
    if (kind === 'man') {
      world.socket.emit('buildStart', { kind: 'man' });
      showToast('👤 Building Man unit... will spawn in 1 minute', 2000, 'info');
      return;
    }

    currentBuildKind = kind;
    fenceMode = (kind === 'woodFence' || kind === 'stoneFence');
    ghostBuilding = makeGhost(kind);
    ghostBuilding.setPosition(0, 0);
    awaitingConfirm = false; world.ui.hideConfirm();
    world.ui.showToast(fenceMode ? 'Click to place each fence section. Right-click / Esc to stop.' : `Move ${SETTINGS.building[kind].label}, then click to place.`);
  });

  // House / Town Center: confirm popup before committing.
  world.ui.onConfirmYes(() => {
    if (!ghostBuilding || !currentBuildKind) return;
    const pos = ghostBuilding.group.position;
    const kind = currentBuildKind;
    if (commitBuild(kind, pos.x, pos.z)) {
      ghostBuilding = null; currentBuildKind = null; awaitingConfirm = false;
      world.ui.hideConfirm(); world.ui.showToast(`${SETTINGS.building[kind].label} under construction…`);
    }
  });
  world.ui.onConfirmMove(() => { awaitingConfirm = false; world.ui.hideConfirm(); });
  world.ui.onConfirmNo(() => { cancelBuild(); });

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    mouseDownPos = { x: e.clientX, y: e.clientY }; isDragging = false;
  };
  const onMouseMove = (e) => {
    if (ghostBuilding && !awaitingConfirm) {
      const gp = groundPoint(e.clientX, e.clientY);
      ghostBuilding.setPosition(gp.x, gp.z);
    }
    if (e.buttons !== 1 || ghostBuilding) return;
    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);
    if (dx > 5 || dy > 5) {
      isDragging = true; controls.enabled = false;
      const x = Math.min(e.clientX, mouseDownPos.x);
      const y = Math.min(e.clientY, mouseDownPos.y);
      selectionBox.style.display = 'block';
      selectionBox.style.left = x + 'px'; selectionBox.style.top = y + 'px';
      selectionBox.style.width = dx + 'px'; selectionBox.style.height = dy + 'px';
    }
  };
  const onMouseUp = (e) => {
    if (e.button !== 0) return;
    controls.enabled = true;
    if (ghostBuilding && !awaitingConfirm) {
      const gp = groundPoint(e.clientX, e.clientY);
      ghostBuilding.setPosition(gp.x, gp.z);
      if (fenceMode) { placeFenceSection(gp.x, gp.z); return; }
      awaitingConfirm = true;
      world.ui.showConfirm(`Place ${SETTINGS.building[currentBuildKind].label} here?`);
      return;
    }
    selectionBox.style.display = 'none';
    if (isDragging) {
      isDragging = false; clearSelection();
      const boxLeft = Math.min(e.clientX, mouseDownPos.x);
      const boxRight = Math.max(e.clientX, mouseDownPos.x);
      const boxTop = Math.min(e.clientY, mouseDownPos.y);
      const boxBottom = Math.max(e.clientY, mouseDownPos.y);
      world.units.forEach((u) => {
        const sp = unitScreenPos(u);
        if (sp.x >= boxLeft && sp.x <= boxRight && sp.y >= boxTop && sp.y <= boxBottom) addToSelection(u);
      });
      return;
    }
    const building = raycastBuilding(e.clientX, e.clientY);
    if (building) {
      if (building.type === 'townCenter') {
        showTownCenterModal(building, world.resources);
      }
      return;
    }

    const u = raycastUnit(e.clientX, e.clientY) || nearestUnit(e.clientX, e.clientY, 35);
    if (u) { if (!e.shiftKey) clearSelection(); addToSelection(u); }
    else if (!e.shiftKey) clearSelection();
  };

  // Command the currently-selected units at a screen point: gather a resource/
  // animal if one is hit, otherwise move there. Shared by right-click (desktop)
  // and tap (mobile). Returns true if a command was issued.
  const commandAt = (cx, cy) => {
    if (ghostBuilding || selected.size === 0) return false;
    // Units are simulated on the SERVER now, so commands go to the server.
    const ids = Array.from(selected).map((u) => u.serverId).filter(Boolean);

    // Building (Town Center / house) — send selected units to deposit their load.
    const depotBuilding = raycastBuilding(cx, cy);
    if (depotBuilding && depotBuilding.storage) {
      world.socket.emit('commandDeposit', { unitIds: ids });
      const bp = (typeof depotBuilding.position === 'function') ? depotBuilding.position() : null;
      if (bp) showResourceHighlight(bp);
      playOk();
      return true;
    }

    // Tree — chop this specific tree (server gather command).
    const tree = raycastGroup(cx, cy, world.trees || []);
    if (tree) {
      world.socket.emit('commandGather', { unitIds: ids, treeId: tree.id });
      showResourceHighlight(tree.position()); playOk(); return true;
    }

    // Animals: hunt/attack them
    const animal = raycastGroup(cx, cy, (world.animals || []).filter(a => a.type === 'chicken' || a.type === 'deer'));
    if (animal) {
      world.socket.emit('commandHunt', { unitIds: ids, animalId: animal.id });
      const p = animal.position();
      showResourceHighlight(p); playOk(); return true;
    }

    // Stone / Gold — walk there (not yet server-side attacking)
    const res = raycastGroup(cx, cy, world.stones || [])
             || raycastGroup(cx, cy, world.golds || []);
    if (res) {
      const p = res.position();
      world.socket.emit('commandMove', { unitIds: ids, x: p.x, z: p.z });
      showResourceHighlight(p); playOk(); return true;
    }

    // Move — walk to the clicked ground point, then resume working from there.
    const gp = groundPoint(cx, cy);
    world.socket.emit('commandMove', { unitIds: ids, x: gp.x, z: gp.z });
    markerGroup.position.set(gp.x, 0, gp.z);
    markerGroup.visible = true; markerTimer = 2.0;
    playOk();
    return true;
  };

  const onRightClick = (e) => {
    e.preventDefault();
    if (ghostBuilding) { cancelBuild(); world.ui.showToast('Build cancelled.'); return; }
    commandAt(e.clientX, e.clientY);
  };

  // Unified tap handler for touch (and works for any pointer): pick a building,
  // unit, or issue a command with already-selected units. This is what makes
  // selecting the Town Center / units actually work on mobile.
  const handleTap = (cx, cy) => {
    if (ghostBuilding && !awaitingConfirm) {
      const gp = groundPoint(cx, cy);
      ghostBuilding.setPosition(gp.x, gp.z);
      if (fenceMode) { placeFenceSection(gp.x, gp.z); return; }
      awaitingConfirm = true;
      world.ui.showConfirm(`Place ${SETTINGS.building[currentBuildKind].label} here?`);
      return;
    }
    const building = raycastBuilding(cx, cy);
    if (building) {
      // If units are selected, tapping a storage building sends them to deposit.
      if (selected.size > 0 && building.storage) {
        const ids = Array.from(selected).map((u) => u.serverId).filter(Boolean);
        world.socket.emit('commandDeposit', { unitIds: ids });
        const bp = (typeof building.position === 'function') ? building.position() : null;
        if (bp) showResourceHighlight(bp);
        playOk();
        return;
      }
      if (building.type === 'townCenter' || building.isTownCenter) showTownCenterModal(building, world.resources);
      return;
    }
    const tappedUnit = raycastUnit(cx, cy) || nearestUnit(cx, cy, 40);
    if (tappedUnit) { clearSelection(); addToSelection(tappedUnit); playOk(); return; }
    // No unit/building tapped: if we have units selected, command them here.
    if (selected.size > 0) { commandAt(cx, cy); return; }
    clearSelection();
  };

  // Touch: distinguish a tap (select/command) from a drag/pinch (camera).
  let touchStart = null;
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: performance.now(), moved: false };
    } else {
      touchStart = null; // multi-touch = pinch/zoom, never a tap
    }
  };
  const onTouchMove = (e) => {
    if (!touchStart || e.touches.length !== 1) { touchStart = null; return; }
    const t = e.touches[0];
    if (Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > 12) touchStart.moved = true;
  };
  const onTouchEnd = (e) => {
    if (!touchStart || touchStart.moved) { touchStart = null; return; }
    if (performance.now() - touchStart.t > 500) { touchStart = null; return; }
    const tap = { x: touchStart.x, y: touchStart.y };
    touchStart = null;
    handleTap(tap.x, tap.y);
  };

  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('contextmenu', onRightClick);
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
  renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });

  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ghostBuilding) { cancelBuild(); world.ui.showToast('Build cancelled.'); return; }
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
  window.addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) Object.keys(keys).forEach(k => keys[k] = false); });

  const update = (time, dt) => {
    const speed = 0.3;
    const az = controls.getAzimuthalAngle();
    const forward = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az)).multiplyScalar(speed);
    const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)).multiplyScalar(speed);
    if (keys['w']) { camera.position.add(forward); controls.target.add(forward); }
    if (keys['s']) { camera.position.sub(forward); controls.target.sub(forward); }
    if (keys['a']) { camera.position.sub(right); controls.target.sub(right); }
    if (keys['d']) { camera.position.add(right); controls.target.add(right); }
    if (keys['q']) { camera.position.y += speed; controls.target.y += speed; }
    if (keys['e']) { camera.position.y -= speed; controls.target.y -= speed; }

    selected.forEach((u) => { const r = ringFor(u); r.position.x = u.group.position.x; r.position.z = u.group.position.z; });

    if (markerTimer > 0) {
      markerTimer -= dt;
      markerGroup.position.y = Math.sin(time * 4) * 0.2;
      if (markerTimer <= 0) markerGroup.visible = false;
    }
    if (resHighlight.visible) {
      resHighlight.material.opacity = 0.7 + Math.sin(time * 5) * 0.2;
      resHighlightTimer -= dt;
      if (resHighlightTimer <= 0) resHighlight.visible = false;
    }
    // Advance any buildings under construction; drop them from the list when done.
    for (let i = constructing.length - 1; i >= 0; i--) {
      const done = constructing[i].tickConstruction(dt, camera);
      if (done) {
        const b = constructing[i];
        world.ui.showToast(`${SETTINGS.building[b.buildingType]?.label || 'Building'} complete!`);
        constructing.splice(i, 1);
      }
    }
    controls.update();
  };

  const dispose = () => {
    renderer.domElement.removeEventListener('mousedown', onMouseDown);
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('mouseup', onMouseUp);
    renderer.domElement.removeEventListener('contextmenu', onRightClick);
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchmove', onTouchMove);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    document.body.removeChild(selectionBox);
    controls.dispose();
  };

  // Center the camera on a unit at a comfortable distance and select it.
  const focusUnit = (unit) => {
    if (!unit) return;
    clearSelection();
    addToSelection(unit);
    const p = unit.group.position;
    const dist = isMobile ? 12 : 14;
    controls.target.set(p.x, 1.2, p.z);
    camera.position.set(p.x, dist * 0.7, p.z + dist);
    controls.update();
  };

  return { update, dispose, focusUnit };
}