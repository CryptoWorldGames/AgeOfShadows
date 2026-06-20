import * as THREE from 'three';
import { SETTINGS } from './Settings.js';

// Create canvas texture for Town Center wooden sign
function createSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Wood grain background
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(0, 0, 256, 256);

  // Add wood grain texture
  for (let i = 0; i < 256; i += 8) {
    ctx.strokeStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
  }

  // Add weathered edges
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let i = 0; i < 256; i += 20) {
    ctx.fillRect(i, 0, 3, 256);
  }

  // Medieval carved border effect
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 236, 236);

  // Text: "TOWN CENTER"
  ctx.fillStyle = '#2a1810';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Draw main text
  ctx.fillText('TOWN', 128, 90);
  ctx.fillText('CENTER', 128, 160);

  // Add carved detail lines
  ctx.strokeStyle = '#5a4a3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 75);
  ctx.lineTo(216, 75);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(40, 180);
  ctx.lineTo(216, 180);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

// Town Center building - realistic medieval courthouse/hall
export function createTownCenter(scene, ghost = true) {
  const group = new THREE.Group();
  const scale = 2.0;

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8b7355, roughness: 0.85, metalness: 0.0,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x5a4033, roughness: 0.9, metalness: 0.0,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.6, metalness: 0.3,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x4a90e2, roughness: 0.05, metalness: 0.4,
    emissive: 0x1a3a7a, emissiveIntensity: ghost ? 0 : 0.2,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });

  // Main base - wide, solid stone structure
  const baseWidth = 5.5 * scale;
  const baseDepth = 4.0 * scale;
  const baseHeight = 2.5 * scale;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth),
    stoneMat
  );
  base.position.y = baseHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Two-tier pitched roof (steep medieval style)
  const roofWidth = baseWidth * 1.1;
  const roofHeight = 2.8 * scale;
  const roofGeo = new THREE.ConeGeometry(roofWidth / Math.sqrt(2), roofHeight, 32);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = baseHeight + roofHeight * 0.4;
  roof.castShadow = true;
  group.add(roof);

  // Bell tower/spire on top
  if (!ghost) {
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.4 * scale, 1.8 * scale, 8),
      trimMat
    );
    spire.position.y = baseHeight + roofHeight * 0.85;
    spire.castShadow = true;
    group.add(spire);

    // Flag on spire
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 * scale, 0.4 * scale, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffff00 })
    );
    flag.position.set(0, baseHeight + roofHeight * 1.1, 0);
    group.add(flag);
  }

  // Grand entrance - arched doorway
  const doorWidth = 1.0 * scale;
  const doorHeight = 2.0 * scale;

  // Door frame (trim)
  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth * 1.3, doorHeight * 1.1, 0.15 * scale),
    trimMat
  );
  doorFrame.position.set(0, doorHeight * 0.5, baseDepth / 2 + 0.1 * scale);
  doorFrame.castShadow = true;
  group.add(doorFrame);

  // Door leaves
  [-0.5, 0.5].forEach((sx) => {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth * 0.6, doorHeight, 0.1 * scale),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 })
    );
    door.position.set(sx * doorWidth * 0.35, doorHeight * 0.5, baseDepth / 2 + 0.08 * scale);
    door.castShadow = true;
    group.add(door);
  });

  // Stone steps up to entrance
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth * 2.0 - i * 0.3 * scale, 0.25 * scale, 0.5 * scale - i * 0.08 * scale),
      stoneMat
    );
    step.position.set(0, 0.125 * scale + i * 0.25 * scale, baseDepth / 2 + 0.4 * scale - i * 0.4 * scale);
    step.receiveShadow = true;
    group.add(step);
  }

  // Columns flanking entrance (medieval style)
  if (!ghost) {
    [-1, 1].forEach((sx) => {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3 * scale, 0.32 * scale, 2.0 * scale, 12),
        stoneMat
      );
      col.position.set(sx * doorWidth * 1.6, baseHeight * 0.4, baseDepth / 2 + 0.2 * scale);
      col.castShadow = true;
      group.add(col);
    });
  }

  // Windows - front face (ground level)
  function addWindow(x, y, z, ry) {
    const wf = new THREE.Mesh(
      new THREE.BoxGeometry(0.7 * scale, 0.9 * scale, 0.12 * scale),
      trimMat
    );
    const wg = new THREE.Mesh(
      new THREE.BoxGeometry(0.55 * scale, 0.75 * scale, 0.18 * scale),
      windowMat
    );
    [wf, wg].forEach((m) => {
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.castShadow = true;
      group.add(m);
    });
  }

  // Front windows (symmetrical)
  const frontZ = baseDepth / 2 + 0.06 * scale;
  const winY1 = 1.2 * scale;
  const winY2 = 1.8 * scale;

  // Lower front windows
  [-1.5, 1.5].forEach((mx) => addWindow(mx * scale, winY1, frontZ, 0));

  // Upper front windows
  [-2.0, -0.5, 0.5, 2.0].forEach((mx) => addWindow(mx * 0.8 * scale, winY2, frontZ, 0));

  // Side windows (both sides)
  [baseWidth / 2 + 0.06 * scale, -baseWidth / 2 - 0.06 * scale].forEach((sxFace) => {
    const isRight = sxFace > 0;
    [-1.2, 0, 1.2].forEach((mz) => addWindow(sxFace, winY1, mz * scale, Math.PI / 2));
    [-0.8, 0.8].forEach((mz) => addWindow(sxFace, winY2, mz * scale, Math.PI / 2));
  });

  // Ground footprint ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.2 * scale, 3.8 * scale, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = ghost;
  group.add(ring);

  scene.add(group);

  const allMats = [stoneMat, roofMat, trimMat, windowMat];

  const building = {
    group,
    type: 'building',
    buildingType: 'townCenter',
    radius: 3.5 * scale,
    storageMax: 100000,
    storage: { wood: 0, stone: 0, gold: 0, food: 0, water: 0 },
    isGhost: ghost,
    isTownCenter: true,
    position: () => group.position.clone(),
    setPosition(x, z) { group.position.set(x, 0, z); },
    setValid(valid) { ring.material.color.setHex(valid ? 0x00ff88 : 0xff3333); },
    place() {
      building.isGhost = false;
      allMats.forEach((m) => { m.transparent = false; m.opacity = 1.0; });
      ring.visible = false;
    },
    getStorageUsed() {
      return Object.values(building.storage).reduce((a,b)=>a+b,0);
    },
    remove() { scene.remove(group); }
  };

  return building;
}

// ---------------------------------------------------------------------------
// Construction progress bar (billboard) shown above a building while it builds.
// ---------------------------------------------------------------------------
function makeConstructionBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85, depthTest: false })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x00d26a, depthTest: false })
  );
  fill.position.z = 0.001; g.add(bg); g.add(fill); g.renderOrder = 999;
  return {
    group: g,
    set(frac) { frac = Math.max(0, Math.min(1, frac)); fill.scale.x = frac; fill.position.x = -(1 - frac) * 1.05; }
  };
}

// Give any building object timed-construction behaviour. While building, the
// structure is semi-transparent with a progress bar; when the timer elapses it
// becomes solid and usable.
function attachConstruction(building, group, allMats, scene, barHeight) {
  const bar = makeConstructionBar();
  bar.group.position.y = barHeight; bar.group.visible = false;
  group.add(bar.group);
  let t = 0, dur = 0;
  building.constructing = false;
  building.startConstruction = (seconds) => {
    building.constructing = true; t = 0; dur = Math.max(0.1, seconds);
    allMats.forEach((m) => { m.transparent = true; m.opacity = 0.4; });
    bar.set(0); bar.group.visible = true;
  };
  building.tickConstruction = (dt, camera) => {
    if (!building.constructing) return false;
    t += dt; bar.set(t / dur);
    if (camera) bar.group.quaternion.copy(camera.quaternion);
    if (t >= dur) { building.completeConstruction(); return true; }
    return false;
  };
  building.completeConstruction = () => {
    building.constructing = false;
    allMats.forEach((m) => { m.transparent = false; m.opacity = 1.0; });
    bar.group.visible = false;
    if (building.place) building.place();
  };
  building.buildProgress = () => (building.constructing ? t / dur : 1);
}

// ---------------------------------------------------------------------------
// House — a personal home: smaller than the Town Center, tax-free storage.
// ---------------------------------------------------------------------------
export function createHouse(scene, ghost = true) {
  const group = new THREE.Group();
  const s = 1.4; // house scale (smaller than town center)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9a877, roughness: 0.9, transparent: ghost, opacity: ghost ? 0.5 : 1.0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a3b25, roughness: 0.85, transparent: ghost, opacity: ghost ? 0.5 : 1.0 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.8, transparent: ghost, opacity: ghost ? 0.5 : 1.0 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x6fa8d4, roughness: 0.1, metalness: 0.3, emissive: 0x244a66, emissiveIntensity: ghost ? 0 : 0.25, transparent: ghost, opacity: ghost ? 0.5 : 1.0 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.0 * s, 2.0 * s, 3.0 * s), wallMat);
  base.position.y = 1.0 * s; base.castShadow = true; base.receiveShadow = true; group.add(base);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5 * s, 1.5 * s, 16), roofMat);
  roof.position.y = 2.75 * s; roof.rotation.y = 0; roof.castShadow = true; group.add(roof);

  const front = 1.5 * s;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 1.3 * s, 0.16 * s), doorMat);
  door.position.set(0, 0.65 * s, front + 0.02 * s); door.castShadow = true; group.add(door);
  [-0.85, 0.85].forEach((mx) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.55 * s, 0.12 * s), winMat);
    w.position.set(mx * s, 1.25 * s, front + 0.02 * s); w.castShadow = true; group.add(w);
  });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.8 * s, 2.1 * s, 28),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.visible = ghost; group.add(ring);

  scene.add(group);
  const allMats = [wallMat, roofMat, doorMat, winMat];

  const building = {
    group, type: 'house', buildingType: 'house',
    radius: 2.1 * s, storageMax: 10000,
    storage: { wood: 0, stone: 0, gold: 0, food: 0, water: 0 },
    isGhost: ghost,
    position: () => group.position.clone(),
    setPosition(x, z) { group.position.set(x, 0, z); },
    setValid(valid) { ring.material.color.setHex(valid ? 0x00ff88 : 0xff3333); },
    place() { building.isGhost = false; allMats.forEach((m) => { m.transparent = false; m.opacity = 1.0; }); ring.visible = false; },
    getStorageUsed() { return Object.values(building.storage).reduce((a, b) => a + b, 0); },
    remove() { scene.remove(group); }
  };
  attachConstruction(building, group, allMats, scene, 4.5 * s);
  return building;
}

// ---------------------------------------------------------------------------
// Fence section — wood or stone. Small solid obstacle; chain them by clicking.
// ---------------------------------------------------------------------------
export function createFence(scene, kind = 'woodFence', ghost = true) {
  const group = new THREE.Group();
  const isStone = kind === 'stoneFence';
  const matColor = isStone ? 0x9a958c : 0x8a5a2b;
  const mat = new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.9, transparent: ghost, opacity: ghost ? 0.5 : 1.0 });

  const width = 1.8, height = isStone ? 1.3 : 1.1, thick = isStone ? 0.35 : 0.2;
  if (isStone) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, thick), mat);
    wall.position.y = height / 2; wall.castShadow = true; wall.receiveShadow = true; group.add(wall);
  } else {
    // wood: two rails + posts
    [-0.8, 0, 0.8].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, 0.16), mat);
      post.position.set(px, height / 2, 0); post.castShadow = true; group.add(post);
    });
    [0.35, 0.8].forEach((ry) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.14, 0.1), mat);
      rail.position.set(0, ry, 0); rail.castShadow = true; group.add(rail);
    });
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.9, 20),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.visible = ghost; group.add(ring);

  scene.add(group);
  const allMats = [mat];
  const S = SETTINGS.building[kind] || {};

  const building = {
    group, type: kind, buildingType: kind,
    radius: 0.95, hitsToDestroy: S.hitsToDestroy || 25,
    isGhost: ghost,
    position: () => group.position.clone(),
    setPosition(x, z) { group.position.set(x, 0, z); },
    setRotation(ry) { group.rotation.y = ry; },
    setValid(valid) { ring.material.color.setHex(valid ? 0x00ff88 : 0xff3333); },
    place() { building.isGhost = false; allMats.forEach((m) => { m.transparent = false; m.opacity = 1.0; }); ring.visible = false; },
    remove() { scene.remove(group); }
  };
  attachConstruction(building, group, allMats, scene, height + 0.6);
  return building;
}