import * as THREE from 'three';

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

    // Wooden sign post
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 2.5 * baseScale, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 })
    );
    signPost.position.set(-2.5 * baseScale, 1.2 * baseScale, 1.5 * baseScale);
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
    signBoard.position.set(-2.5 * baseScale, 2.0 * baseScale, 1.5 * baseScale);
    signBoard.castShadow = true;
    signBoard.rotation.y = 0.3;
    group.add(signBoard);
  }

  // Door frame
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x2a1810,
    roughness: 0.8,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1.0
  });
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.4, 0.2),
    doorMat
  );
  door.position.set(0, 0.7, 2.3);
  door.castShadow = true;
  group.add(door);

  // Windows (realistic detail)
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x4a6fa5,
    roughness: 0.1,
    metalness: 0.3,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1.0
  });

  // Window 1 (left)
  const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.15), windowMat);
  win1.position.set(-1.0, 1.2, 2.3);
  win1.castShadow = true;
  group.add(win1);

  // Window 2 (right)
  const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.15), windowMat);
  win2.position.set(1.0, 1.2, 2.3);
  win2.castShadow = true;
  group.add(win2);

  // Side window
  const win3 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.15), windowMat);
  win3.position.set(2.3, 1.2, 0);
  win3.rotation.y = Math.PI / 2;
  win3.castShadow = true;
  group.add(win3);

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

  const allMats = [wallMat, roofMat, doorMat, windowMat];

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