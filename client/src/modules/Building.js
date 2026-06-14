import * as THREE from 'three';

// Town Center building.
// Ghost mode: transparent, follows cursor on the ground, not collidable.
// Placed mode: solid, permanent, collidable.
export function createTownCenter(scene, ghost = true) {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xc9a36a, roughness: 0.85,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x8a3b2b, roughness: 0.8,
    transparent: ghost, opacity: ghost ? 0.5 : 1.0
  });

  // Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), wallMat);
  base.position.y = 1;
  base.castShadow = true; base.receiveShadow = true;
  group.add(base);

  // Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 4), roofMat);
  roof.position.y = 2.9;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Door
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x3a2415, transparent: ghost, opacity: ghost ? 0.5 : 1.0 })
  );
  door.position.set(0, 0.65, 2.01);
  group.add(door);

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

  const allMats = [wallMat, roofMat, door.material];

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