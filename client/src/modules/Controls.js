import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTownCenter } from './Building.js';

export function createControls(camera, renderer, scene, world, playerStartPos) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  controls.minDistance = isMobile ? 3 : 8;
  controls.maxDistance = 150;
  if (isMobile && playerStartPos) {
    controls.target.copy(playerStartPos);
    camera.position.set(playerStartPos.x + 2, playerStartPos.y + 3, playerStartPos.z + 3);
  }
  controls.minPolarAngle = Math.PI / 6;
  controls.maxPolarAngle = Math.PI / 3;
  controls.zoomToCursor = false;
  controls.mouseButtons = { MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.enableRotate = false;
  controls.target.set(0, 0, 0);
  controls.update();

  const okSound = new Audio('/sounds/pensieri_profondi_scuba-ok-274157.mp3');

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

  world.ui.onTownCenterClick(() => {
    if (ghostBuilding) return;
    if (world.resources.wood < 100) {
      world.ui.showToast('Need 100 wood to build Town Center!'); return;
    }
    ghostBuilding = createTownCenter(scene, true);
    ghostBuilding.setPosition(0, 0);
    awaitingConfirm = false; world.ui.hideConfirm();
  });
  world.ui.onConfirmYes(() => {
    if (!ghostBuilding) return;
    world.resources.wood -= 100;
    ghostBuilding.place(); world.buildings.push(ghostBuilding);
    ghostBuilding = null; awaitingConfirm = false;
    world.ui.hideConfirm(); world.ui.showToast('Town Center placed! (-100 wood)');
  });
  world.ui.onConfirmMove(() => { awaitingConfirm = false; world.ui.hideConfirm(); });
  world.ui.onConfirmNo(() => {
    if (ghostBuilding) ghostBuilding.remove();
    ghostBuilding = null; awaitingConfirm = false; world.ui.hideConfirm();
  });

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
      awaitingConfirm = true; world.ui.showConfirm(); return;
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
    const u = raycastUnit(e.clientX, e.clientY) || nearestUnit(e.clientX, e.clientY, 35);
    if (u) { if (!e.shiftKey) clearSelection(); addToSelection(u); }
    else if (!e.shiftKey) clearSelection();
  };

  const onRightClick = (e) => {
    e.preventDefault();
    if (ghostBuilding || selected.size === 0) return;

    // Chicken
    const chicken = raycastGroup(e.clientX, e.clientY, (world.animals || []).filter(a => a.type === 'chicken' || a.type === 'deer'));
    if (chicken) {
      const arr = Array.from(selected);
      const cp = chicken.position();
      arr.forEach((u, i) => {
        const ang = (i / arr.length) * Math.PI * 2;
        u.killAnimal(chicken, { x: cp.x + Math.cos(ang) * 0.8, z: cp.z + Math.sin(ang) * 0.8 });
      });
      showResourceHighlight(cp); okSound.currentTime = 0; okSound.play(); return;
    }

    // Stone
    const stone = raycastGroup(e.clientX, e.clientY, world.stones || []);
    if (stone) {
      const arr = Array.from(selected);
      const sp = stone.position();
      arr.forEach((u, i) => {
        const ang = (i / arr.length) * Math.PI * 2;
        u.mineStone(stone, { x: sp.x + Math.cos(ang) * 1.5, z: sp.z + Math.sin(ang) * 1.5 });
      });
      showResourceHighlight(sp); okSound.currentTime = 0; okSound.play(); return;
    }

    // Gold
    const gold = raycastGroup(e.clientX, e.clientY, world.golds || []);
    if (gold) {
      const arr = Array.from(selected);
      const gp2 = gold.position();
      arr.forEach((u, i) => {
        const ang = (i / arr.length) * Math.PI * 2;
        u.mineGold(gold, { x: gp2.x + Math.cos(ang) * 1.5, z: gp2.z + Math.sin(ang) * 1.5 });
      });
      showResourceHighlight(gp2); okSound.currentTime = 0; okSound.play(); return;
    }

    // Tree
    const tree = raycastGroup(e.clientX, e.clientY, world.trees || []);
    if (tree) {
      const arr = Array.from(selected);
      const tp = tree.position();
      arr.forEach((u, i) => {
        const ang = (i / arr.length) * Math.PI * 2;
        u.chopTree(tree, { x: tp.x + Math.cos(ang) * 1.3, z: tp.z + Math.sin(ang) * 1.3 });
      });
      showResourceHighlight(tp); okSound.currentTime = 0; okSound.play(); return;
    }

    // Move
    const gp = groundPoint(e.clientX, e.clientY);
    Array.from(selected).forEach((u, i) => {
      let ox = 0, oz = 0;
      if (selected.size > 1) {
        const ring = 1 + Math.floor(i / 8);
        const ang = (i % 8) / 8 * Math.PI * 2;
        ox = Math.cos(ang) * ring * 1.1; oz = Math.sin(ang) * ring * 1.1;
      }
      u.moveTo(new THREE.Vector3(gp.x + ox, 0, gp.z + oz));
    });
    markerGroup.position.set(gp.x, 0, gp.z);
    markerGroup.visible = true; markerTimer = 2.0;
    okSound.currentTime = 0; okSound.play();
  };

  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('contextmenu', onRightClick);

  const keys = {};
  window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
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
    controls.update();
  };

  const dispose = () => {
    renderer.domElement.removeEventListener('mousedown', onMouseDown);
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('mouseup', onMouseUp);
    renderer.domElement.removeEventListener('contextmenu', onRightClick);
    document.body.removeChild(selectionBox);
    controls.dispose();
  };

  return { update, dispose };
}