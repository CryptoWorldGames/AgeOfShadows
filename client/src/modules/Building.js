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

// Town Center building.
// Ghost mode: transparent, follows cursor on the ground, not collidable.
// Placed mode: solid, permanent, collidable.
export function createTownCenter(scene, ghost = true) {
  const group = new THREE.Group();

  // Improved materials with better detail
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xb8936a,
    roughness: 0.9,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1.0,
    side: THREE.FrontSide
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x6b2f20,
    roughness: 0.85,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1.0
  });

  // Main wooden structure (Town Center is 2x bigger than house)
  const baseScale = ghost ? 1 : 2.0;
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.5 * baseScale, 2.2 * baseScale, 4.5 * baseScale), wallMat);
  base.position.y = 1.1 * baseScale;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Pitched roof (more realistic)
  const roofGeo = new THREE.ConeGeometry(3.4 * baseScale, 2.0 * baseScale, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 3.2 * baseScale;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Add flag on top for Town Center (distinctive marker)
  if (!ghost) {
    const flagpole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 3 * baseScale, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    );
    flagpole.position.set(0, 3.5 * baseScale, 0);
    group.add(flagpole);

    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.8 * baseScale, 0.5 * baseScale, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffff00 })
    );
    flag.position.set(0.5 * baseScale, 4.8 * baseScale, 0);
    group.add(flag);

    // Wooden sign post — front-center, raised high so it's readable from camera angle
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 2.5 * baseScale, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 })
    );
    signPost.position.set(-3.6 * baseScale, 1.0 * baseScale, 4.0 * baseScale);
    signPost.castShadow = true;
    group.add(signPost);

    // Wooden sign board — same front-center position, readable
    const signMat = new THREE.MeshStandardMaterial({
      color: 0xa0826d,
      roughness: 0.7,
      map: createSignTexture()
    });
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * baseScale, 0.8 * baseScale, 0.1 * baseScale),
      signMat
    );
    signBoard.position.set(-3.6 * baseScale, 2.0 * baseScale, 4.0 * baseScale);
    signBoard.castShadow = true;
    signBoard.rotation.y = 0;
    group.add(signBoard);
  }

  // The wall faces sit at ±half-width. Everything below is placed ON those faces
  // (scaled by baseScale) so the door/windows aren't buried inside the walls.
  const front = 2.25 * baseScale;   // +z front wall face
  const side = 2.25 * baseScale;    // +x / -x side wall faces

  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x3a2414, roughness: 0.8, transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xe8e2d0, roughness: 0.7, transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x6fa8d4, roughness: 0.08, metalness: 0.35,
    emissive: 0x244a66, emissiveIntensity: ghost ? 0 : 0.25,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });

  // --- Grand double-door entrance (courthouse style) ---
  const doorW = 0.7 * baseScale, doorH = 1.7 * baseScale;
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW * 2.4, doorH * 1.15, 0.18 * baseScale), trimMat);
  doorFrame.position.set(0, doorH * 0.575, front + 0.02 * baseScale);
  doorFrame.castShadow = true; group.add(doorFrame);
  [-0.5, 0.5].forEach((sx) => {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.95, doorH, 0.16 * baseScale), doorMat);
    leaf.position.set(sx * doorW, doorH * 0.5, front + 0.08 * baseScale);
    leaf.castShadow = true; group.add(leaf);
  });

  // --- Stone steps up to the entrance ---
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(doorW * 3.2 - s * 0.4 * baseScale, 0.18 * baseScale, (0.5 - s * 0.13) * baseScale),
      trimMat
    );
    step.position.set(0, 0.09 * baseScale + s * 0.18 * baseScale, front + (0.55 - s * 0.13) * baseScale);
    step.receiveShadow = true; group.add(step);
  }

  // --- Two columns flanking the door (the courthouse signature) ---
  if (!ghost) {
    [-1, 1].forEach((sx) => {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * baseScale, 0.26 * baseScale, 2.0 * baseScale, 12),
        trimMat
      );
      col.position.set(sx * doorW * 1.9, 1.0 * baseScale, front + 0.25 * baseScale);
      col.castShadow = true; group.add(col);
      // simple capital + base
      [0.05, 1.95].forEach((cy) => {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6 * baseScale, 0.15 * baseScale, 0.6 * baseScale), trimMat);
        cap.position.set(sx * doorW * 1.9, cy * baseScale, front + 0.25 * baseScale);
        cap.castShadow = true; group.add(cap);
      });
    });
    // Triangular pediment over the entrance
    const ped = new THREE.Mesh(new THREE.ConeGeometry(doorW * 2.4, 0.7 * baseScale, 3), trimMat);
    ped.rotation.y = Math.PI / 2; ped.position.set(0, 2.25 * baseScale, front + 0.1 * baseScale);
    ped.castShadow = true; group.add(ped);
  }

  // --- Rows of tall windows across the front and sides ---
  function addWindow(x, y, z, ry) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62 * baseScale, 1.0 * baseScale, 0.1 * baseScale), trimMat);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.48 * baseScale, 0.82 * baseScale, 0.16 * baseScale), windowMat);
    [frame, glass].forEach((m) => { m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; group.add(m); });
  }
  const winY = 1.25 * baseScale;
  // front windows (flanking the door, outside the columns)
  [-1.9, 1.9].forEach((mx) => addWindow(mx * doorW * 1.0 * 1.7, winY, front + 0.04 * baseScale, 0));
  // upper-floor front windows
  [-1, 0, 1].forEach((mx) => addWindow(mx * 1.3 * baseScale, winY + 1.15 * baseScale, front + 0.04 * baseScale, 0));
  // side windows (both sides)
  [side, -side].forEach((sxFace) => {
    [-1, 1].forEach((mz) => addWindow(sxFace + (sxFace > 0 ? 0.04 : -0.04) * baseScale, winY, mz * 1.2 * baseScale, Math.PI / 2));
  });

  // Ground footprint ring (helps aim while placing)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6 * baseScale, 3.0 * baseScale, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = ghost;
  group.add(ring);

  scene.add(group);

  const allMats = [wallMat, roofMat, doorMat, windowMat, trimMat];

  const building = {
    group,
    type: 'building',
    buildingType: 'townCenter',
    radius: 3.0 * baseScale,
    storageMax: 100000,
    storage: { wood: 0, stone: 0, gold: 0, food: 0, water: 0 },
    isGhost: ghost,
    isTownCenter: true,
    position: () => group.position.clone(),
    setPosition(x, z) { group.position.set(x, 0, z); },
    setValid(valid) {
      ring.material.color.setHex(valid ? 0x00ff88 : 0xff3333);
    },
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

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5 * s, 1.5 * s, 4), roofMat);
  roof.position.y = 2.75 * s; roof.rotation.y = Math.PI / 4; roof.castShadow = true; group.add(roof);

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