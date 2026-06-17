import * as THREE from 'three';

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

  // Main wooden structure
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 4.5), wallMat);
  base.position.y = 1.1;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Pitched roof (more realistic)
  const roofGeo = new THREE.ConeGeometry(3.4, 2.0, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 3.2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

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
    new THREE.RingGeometry(2.6, 3.0, 32),
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
    radius: 3.0,
    isGhost: ghost,
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
    remove() { scene.remove(group); }
  };

  return building;
}