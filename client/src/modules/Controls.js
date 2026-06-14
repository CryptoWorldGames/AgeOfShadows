import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTownCenter } from './Building.js';

export function createControls(camera, renderer, scene, world) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 2;
  controls.maxDistance = 150;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.zoomToCursor = true;
  controls.mouseButtons = {
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  controls.enableRotate = false;

  const okSound = new Audio('/sounds/pensieri_profondi_scuba-ok-274157.mp3');

  // Move marker (orange arrow)
  const markerGroup = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.8, 8),
    new THREE.MeshPhongMaterial({ color: 0xff6600 })
  );
  cone.position.y = 1.5; cone.rotation.z = Math.PI;
  markerGroup.add(cone);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8),
    new THREE.MeshPhongMaterial({ color: 0x8B4513 })
  );
  shaft.position.y = 2.4; markerGroup.add(shaft);
  markerGroup.visible = false;
  scene.add(markerGroup);

  // Resource highlight ring (appears under a tree/stone/gold/animal you right-click)
  const resHighlight = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.15, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff66, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  resHighlight.rotation.x = -Math.PI / 2;
  resHighlight.position.y = 0.04;
  resHighlight.visible = false;
  scene.add(resHighlight);
  let resHighlightTimer = 0;
  let resHighlightPersist = false; // stays while workers are assigned to it

  const rings = new Map();
  function ringFor(unit) {
    if (!rings.has(unit)) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 28),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.05;
      r.visible = false;
      scene.add(r);
      rings.set(unit, r);
    }
    return rings.get(unit);
  }

  const selectionBox = document.createElement('div');
  selectionBox.style.cssText = `
    position: fixed; border: 2px solid #00ff00;
    background: rgba(0,255,0,0.1); pointer-events: none;
    display: none; z-index: 999;
  `;
  document.body.appendChild(selectionBox);

  const selected = new Set();
  let markerTimer = 0;
  let mouseDownPos = { x: 0, y: 0 };
  let isDragging = false;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  let ghostBuilding = null;
  let awaitingConfirm = false;

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
    let cy = 1.0;
    try { cy = unit.getModelCenterY(); } catch (e) {}
    p.y = cy;
    p.project(camera);
    return {
      x: (p.x + 1) / 2 * rect.width + rect.left,
      y: (-p.y + 1) / 2 * rect.height + rect.top
    };
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

  function raycastTree(cx, cy) {
    setMouseFromEvent(cx, cy);
    raycaster.setFromCamera(mouse, camera);
    for (const tree of world.trees) {
      if (tree.isDepleted()) continue;
      const meshes = [];
      tree.group.updateMatrixWorld(true);
      tree.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
      if (raycaster.intersectObjects(meshes, true).length > 0) return tree;
    }
    return null;
  }

  function clearSelection() {
    selected.forEach((u) => { u.setSelected(false); ringFor(u).visible = false; });
    selected.clear();
    world.ui.setSelectedCount(0);
  }
  function addToSelection(u) {
    selected.add(u);
    u.setSelected(true);
    ringFor(u).visible = true;
    world.ui.setSelectedCount(selected.size);
  }

  function showResourceHighlight(pos, persist) {
    resHighlight.position.set(pos.x, 0.04, pos.z);
    resHighlight.visible = true;
    resHighlightTimer = 1.0;
    resHighlightPersist = !!persist;
  }

  world.ui.onTownCenterClick(() => {
    if (ghostBuilding) return;
    ghostBuilding = createTownCenter(scene, true);
    ghostBuilding.setPosition(0, 0);
    awaitingConfirm = false;
    world.ui.hideConfirm();
  });
  world.ui.onConfirmYes(() => {
    if (!ghostBuilding) return;
    ghostBuilding.place();
    world.buildings.push(ghostBuilding);
    ghostBuilding = null;
    awaitingConfirm = false;
    world.ui.hideConfirm();
  });
  world.ui.onConfirmMove(() => {
    awaitingConfirm = false;
    world.ui.hideConfirm();
  });
  world.ui.onConfirmNo(() => {
    if (ghostBuilding) ghostBuilding.remove();
    ghostBuilding = null;
    awaitingConfirm = false;
    world.ui.hideConfirm();
  });

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    mouseDownPos = { x: e.clientX, y: e.clientY };
    isDragging = false;
  };

  const onMouseMove = (e) => {
    if (ghostBuilding && !awaitingConfirm) {
      const gp = groundPoint(e.clientX, e.clientY);
      ghostBuilding.setPosition(gp.x, gp.z);
    }
    if (e.buttons !== 1) return;
    if (ghostBuilding) return;
    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);
    if (dx > 5 || dy > 5) {
      isDragging = true;
      controls.enabled = false;
      const x = Math.min(e.clientX, mouseDownPos.x);
      const y = Math.min(e.clientY, mouseDownPos.y);
      selectionBox.style.display = 'block';
      selectionBox.style.left = x + 'px';
      selectionBox.style.top = y + 'px';
      selectionBox.style.width = dx + 'px';
      selectionBox.style.height = dy + 'px';
    }
  };

  const onMouseUp = (e) => {
    if (e.button !== 0) return;
    controls.enabled = true;

    if (ghostBuilding && !awaitingConfirm) {
      const gp = groundPoint(e.clientX, e.clientY);
      ghostBuilding.setPosition(gp.x, gp.z);
      awaitingConfirm = true;
      world.ui.showConfirm();
      return;
    }

    selectionBox.style.display = 'none';

    if (isDragging) {
      isDragging = false;
      clearSelection();
      const boxLeft = Math.min(e.clientX, mouseDownPos.x);
      const boxRight = Math.max(e.clientX, mouseDownPos.x);
      const boxTop = Math.min(e.clientY, mouseDownPos.y);
      const boxBottom = Math.max(e.clientY, mouseDownPos.y);
      world.units.forEach((u) => {
        const sp = unitScreenPos(u);
        if (sp.x >= boxLeft && sp.x <= boxRight && sp.y >= boxTop && sp.y <= boxBottom) {
          addToSelection(u);
        }
      });
      return;
    }

    const u = raycastUnit(e.clientX, e.clientY) || nearestUnit(e.clientX, e.clientY, 35);
    if (u) {
      if (!e.shiftKey) clearSelection();
      addToSelection(u);
    } else if (!e.shiftKey) {
      clearSelection();
    }
  };

  const onRightClick = (e) => {
    e.preventDefault();
    if (ghostBuilding) return;
    if (selected.size === 0) return;

    const tree = raycastTree(e.clientX, e.clientY);
    if (tree) {
      const arr = Array.from(selected);
      const n = arr.length;
      const tp = tree.position();
      arr.forEach((u, i) => {
        const ang = (i / n) * Math.PI * 2;
        const slotX = tp.x + Math.cos(ang) * 1.3;
        const slotZ = tp.z + Math.sin(ang) * 1.3;
        u.chopTree(tree, { x: slotX, z: slotZ });
      });
      showResourceHighlight(tp, true); // highlight the resource being worked
      okSound.currentTime = 0; okSound.play();
      return;
    }

    const gp = groundPoint(e.clientX, e.clientY);
    const arr = Array.from(selected);
    const n = arr.length;
    arr.forEach((u, i) => {
      let ox = 0, oz = 0;
      if (n > 1) {
        const ring = 1 + Math.floor(i / 8);
        const ang = (i % 8) / 8 * Math.PI * 2;
        ox = Math.cos(ang) * ring * 1.1;
        oz = Math.sin(ang) * ring * 1.1;
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

    selected.forEach((u) => {
      const r = ringFor(u);
      r.position.x = u.group.position.x;
      r.position.z = u.group.position.z;
    });

    if (markerTimer > 0) {
      markerTimer -= dt;
      markerGroup.position.y = Math.sin(time * 4) * 0.2;
      if (markerTimer <= 0) markerGroup.visible = false;
    }

    // Resource highlight: pulse, then fade unless persisting
    if (resHighlight.visible) {
      const pulse = 0.7 + Math.sin(time * 5) * 0.2;
      resHighlight.material.opacity = pulse;
      if (!resHighlightPersist) {
        resHighlightTimer -= dt;
        if (resHighlightTimer <= 0) resHighlight.visible = false;
      }
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