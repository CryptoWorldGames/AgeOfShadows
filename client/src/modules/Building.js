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

// Town Center building - Age of Empires style fortress
// Ghost mode: transparent, follows cursor on the ground, not collidable.
// Placed mode: solid, permanent, collidable.
export function createTownCenter(scene, ghost = true) {
  const group = new THREE.Group();

  // Stone fortress materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xa89968,
    roughness: 0.85,
    metalness: 0.05,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1.0,
    side: THREE.FrontSide
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a,
    roughness: 0.9,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1.0
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xd4b896,
    roughness: 0.8,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1.0
  });

  // Main fortress structure - solid, imposing stone walls
  const baseScale = ghost ? 1 : 2.0;
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.0 * baseScale, 3.0 * baseScale, 5.0 * baseScale), stoneMat);
  base.position.y = 1.5 * baseScale;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Steep pitched roof for Age of Empires appearance
  const roofGeo = new THREE.ConeGeometry(3.8 * baseScale, 2.4 * baseScale, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 3.6 * baseScale;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Add tower turrets on corners for fortress look
  if (!ghost) {
    [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].forEach(([x, z]) => {
      const turret = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6 * baseScale, 0.7 * baseScale, 3.2 * baseScale, 8),
        stoneMat
      );
      turret.position.set(x, 1.6 * baseScale, z);
      turret.castShadow = true;
      group.add(turret);

      // Turret roof
      const turretRoof = new THREE.Mesh(
        new THREE.ConeGeometry(0.8 * baseScale, 0.8 * baseScale, 8),
        roofMat
      );
      turretRoof.position.set(x, 3.4 * baseScale, z);
      turretRoof.castShadow = true;
      group.add(turretRoof);
    });

    // Tall flag pole on top (Age of Empires style)
    const flagpole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * baseScale, 0.08 * baseScale, 2.5 * baseScale, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a })
    );
    flagpole.position.set(0, 4.3 * baseScale, 0);
    flagpole.castShadow = true;
    group.add(flagpole);

    // Flag banner
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.8 * baseScale, 0.5 * baseScale, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    flag.position.set(0.5 * baseScale, 5.0 * baseScale, 0);
    flag.castShadow = true;
    group.add(flag);

    // Wooden sign post — front-center, readable
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * baseScale, 0.18 * baseScale, 2.2 * baseScale, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 })
    );
    signPost.position.set(0, 1.1 * baseScale, 3.0 * baseScale);
    signPost.castShadow = true;
    group.add(signPost);

    // Wooden sign board
    const signMat = new THREE.MeshStandardMaterial({
      color: 0xa0826d,
      roughness: 0.7,
      map: createSignTexture()
    });
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * baseScale, 0.8 * baseScale, 0.1 * baseScale),
      signMat
    );
    signBoard.position.set(0, 1.8 * baseScale, 3.1 * baseScale);
    signBoard.castShadow = true;
    group.add(signBoard);
  }

  // Fortress entrance configuration
  const front = 2.5 * baseScale;   // +z front wall face
  const side = 2.5 * baseScale;    // +x / -x side wall faces

  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x2a1810, roughness: 0.9, transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x5a8aaa, roughness: 0.1, metalness: 0.2,
    emissive: 0x1a3a4a, emissiveIntensity: ghost ? 0 : 0.2,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });

  // --- Grand fortress entrance with double doors ---
  const doorW = 0.6 * baseScale, doorH = 1.8 * baseScale;

  // Door frame/archway
  const doorFrameGroup = new THREE.Group();

  // Arched doorway frame (stone)
  const archFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorW * 2.2, doorH * 1.2, 0.2 * baseScale),
    trimMat
  );
  archFrame.position.z = 0.02 * baseScale;
  doorFrameGroup.add(archFrame);

  // Double doors
  [-doorW * 0.5, doorW * 0.5].forEach((sx) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.15 * baseScale), doorMat);
    door.position.set(sx, doorH * 0.5, 0.08 * baseScale);
    door.castShadow = true;
    doorFrameGroup.add(door);
  });

  doorFrameGroup.position.set(0, 1.2 * baseScale, front);
  doorFrameGroup.castShadow = true;
  group.add(doorFrameGroup);

  // Stone steps up to entrance (3 steps)
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(2.2 * baseScale - s * 0.3 * baseScale, 0.2 * baseScale, 0.5 * baseScale),
      trimMat
    );
    step.position.set(0, 0.1 * baseScale + s * 0.2 * baseScale, front + 0.4 * baseScale - s * 0.5 * baseScale);
    step.receiveShadow = true;
    group.add(step);
  }

  // Crenellations (fortress battlements) on top of walls if placed
  if (!ghost) {
    // Front crenellations
    for (let i = -2; i <= 2; i++) {
      const cren = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 * baseScale, 0.6 * baseScale, 0.3 * baseScale),
        stoneMat
      );
      cren.position.set(i * 0.9 * baseScale, 3.0 * baseScale, front);
      cren.castShadow = true;
      group.add(cren);
    }
    // Side crenellations
    [side, -side].forEach((sxFace) => {
      for (let i = -2; i <= 2; i++) {
        const cren = new THREE.Mesh(
          new THREE.BoxGeometry(0.3 * baseScale, 0.6 * baseScale, 0.3 * baseScale),
          stoneMat
        );
        cren.position.set(sxFace, 3.0 * baseScale, i * 0.9 * baseScale);
        cren.castShadow = true;
        group.add(cren);
      }
    });
  }

  // --- Windows: properly embedded in walls, not floating ---
  function addWindow(x, y, z, ry) {
    const frameSize = 0.6 * baseScale;
    const glassSize = 0.45 * baseScale;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(frameSize, frameSize, 0.12 * baseScale),
      trimMat
    );
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(glassSize, glassSize, 0.16 * baseScale),
      windowMat
    );

    frame.position.set(x, y, z);
    glass.position.set(x, y, z + 0.02 * baseScale);
    frame.rotation.y = ry;
    glass.rotation.y = ry;
    frame.castShadow = true;
    glass.castShadow = true;

    group.add(frame);
    group.add(glass);
  }

  const winY = 1.8 * baseScale;
  // Front windows (flanking the doors)
  [-1.5, 1.5].forEach((mx) => addWindow(mx * baseScale, winY, front, 0));

  // Side windows
  [side, -side].forEach((sxFace) => {
    [-1.2, 1.2].forEach((mz) => addWindow(sxFace, winY, mz * baseScale, Math.PI / 2));
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

  const allMats = [stoneMat, roofMat, doorMat, windowMat, trimMat];

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

  // Create hammers that animate during construction
  const hammers = [];
  for (let i = 0; i < 4; i++) {
    const hammerGroup = new THREE.Group();
    const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.08), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    hammerHead.position.y = 0.05;
    const hammerHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: 0x654321 }));
    hammerHandle.position.y = 0.25;
    hammerGroup.add(hammerHead);
    hammerGroup.add(hammerHandle);
    hammerGroup.position.set((i - 1.5) * 0.8, 0, 1.2);
    group.add(hammerGroup);
    hammers.push({ group: hammerGroup, startY: hammerGroup.position.y, phase: i * 0.5 });
  }

  let t = 0, dur = 0;
  building.constructing = false;
  building.startConstruction = (seconds) => {
    building.constructing = true; t = 0; dur = Math.max(0.1, seconds);
    allMats.forEach((m) => { m.transparent = true; m.opacity = 0.4; });
    bar.set(0); bar.group.visible = true;
    hammers.forEach(h => h.group.visible = true);
  };
  building.tickConstruction = (dt, camera) => {
    if (!building.constructing) return false;
    t += dt; bar.set(t / dur);
    if (camera) bar.group.quaternion.copy(camera.quaternion);

    // Animate hammers: bounce up and down
    hammers.forEach((h, i) => {
      const hammerTime = t + h.phase;
      const bounce = Math.sin(hammerTime * 8) * 0.3;
      h.group.position.y = h.startY + Math.max(0, bounce);
      h.group.rotation.z = Math.sin(hammerTime * 8) * 0.3;
    });

    if (t >= dur) { building.completeConstruction(); return true; }
    return false;
  };
  building.completeConstruction = () => {
    building.constructing = false;
    allMats.forEach((m) => { m.transparent = false; m.opacity = 1.0; });
    bar.group.visible = false;
    hammers.forEach(h => h.group.visible = false);
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