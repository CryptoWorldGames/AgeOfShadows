import * as THREE from 'three';

export function createEnvironment(scene) {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0xb0d8f0, 90, 230);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(60, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xc8e0ff, 0.55);
  scene.add(ambient);

  const loader = new THREE.TextureLoader();

  // Grass ground — sized to match wall boundary
  const grassTex = loader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/grass_path_2/grass_path_2_diff_1k.jpg');
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(20, 20);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x4a7a3a, map: grassTex, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Dirt roads
  const road1Mat = new THREE.MeshStandardMaterial({ color: 0x9a7a50, roughness: 1.0 });
  const road2Mat = new THREE.MeshStandardMaterial({ color: 0x9a7a50, roughness: 1.0 });
  const road3Mat = new THREE.MeshStandardMaterial({ color: 0x9a7a50, roughness: 1.0 });
  const road1 = new THREE.Mesh(new THREE.PlaneGeometry(5, 140), road1Mat);
  road1.rotation.x = -Math.PI / 2; road1.position.set(0, 0.01, 0); scene.add(road1);
  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(140, 5), road2Mat);
  road2.rotation.x = -Math.PI / 2; road2.position.set(0, 0.01, -20); scene.add(road2);
  const road3 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 70), road3Mat);
  road3.rotation.x = -Math.PI / 2; road3.rotation.z = Math.PI / 5; road3.position.set(25, 0.01, 15); scene.add(road3);
  loader.load(
    'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_mud_02/brown_mud_02_diff_1k.jpg',
    (tex) => {
      const t1 = tex.clone(); t1.wrapS = THREE.RepeatWrapping; t1.wrapT = THREE.RepeatWrapping; t1.repeat.set(1, 28); t1.needsUpdate = true;
      road1Mat.map = t1; road1Mat.needsUpdate = true;
      const t2 = tex.clone(); t2.wrapS = THREE.RepeatWrapping; t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(28, 1); t2.needsUpdate = true;
      road2Mat.map = t2; road2Mat.needsUpdate = true;
      const t3 = tex.clone(); t3.wrapS = THREE.RepeatWrapping; t3.wrapT = THREE.RepeatWrapping; t3.repeat.set(1, 14); t3.needsUpdate = true;
      road3Mat.map = t3; road3Mat.needsUpdate = true;
    }
  );

  // ===== CASTLE BRICK WALLS =====
  const mapSize = 150;
  const wallH = 5;
  const wallT = 2.5;

  // Castle brick material — load stone texture
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.95 });
  const crenMat = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.95 });
  loader.load(
    'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/castle_brick_07/castle_brick_07_diff_1k.jpg',
    (tex) => {
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      // Side walls
      const tw = tex.clone(); tw.repeat.set(20, 2); tw.needsUpdate = true;
      wallMat.map = tw; wallMat.needsUpdate = true;
      crenMat.map = tw; crenMat.needsUpdate = true;
    },
    undefined,
    () => console.warn('Castle brick texture not found, using color fallback')
  );

  // Four walls
  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(mapSize * 2 + wallT * 2, wallH, wallT), wallMat);
  wallTop.position.set(0, wallH / 2, -mapSize); wallTop.castShadow = true; wallTop.receiveShadow = true; scene.add(wallTop);
  const wallBot = new THREE.Mesh(new THREE.BoxGeometry(mapSize * 2 + wallT * 2, wallH, wallT), wallMat);
  wallBot.position.set(0, wallH / 2, mapSize); wallBot.castShadow = true; wallBot.receiveShadow = true; scene.add(wallBot);
  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, mapSize * 2), wallMat);
  wallLeft.position.set(-mapSize, wallH / 2, 0); wallLeft.castShadow = true; wallLeft.receiveShadow = true; scene.add(wallLeft);
  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, mapSize * 2), wallMat);
  wallRight.position.set(mapSize, wallH / 2, 0); wallRight.castShadow = true; wallRight.receiveShadow = true; scene.add(wallRight);

  // Crenellations (battlements)
  const crenW = 3.5, crenH = 2, crenD = wallT + 0.5;
  const crenCount = 24;
  for (let i = 0; i < crenCount; i++) {
    if (i % 2 === 0) continue; // alternating gaps
    const t = -mapSize + (i / crenCount) * mapSize * 2;
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(crenW, crenH, crenD), crenMat);
    c1.position.set(t, wallH + crenH / 2, -mapSize); scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(crenW, crenH, crenD), crenMat);
    c2.position.set(t, wallH + crenH / 2, mapSize); scene.add(c2);
    const c3 = new THREE.Mesh(new THREE.BoxGeometry(crenD, crenH, crenW), crenMat);
    c3.position.set(-mapSize, wallH + crenH / 2, t); scene.add(c3);
    const c4 = new THREE.Mesh(new THREE.BoxGeometry(crenD, crenH, crenW), crenMat);
    c4.position.set(mapSize, wallH + crenH / 2, t); scene.add(c4);
  }

  // Corner towers with cone roofs
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.8 });
  [[-mapSize, -mapSize], [mapSize, -mapSize], [-mapSize, mapSize], [mapSize, mapSize]].forEach(([tx, tz]) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, wallH + 4, 10), towerMat);
    tower.position.set(tx, (wallH + 4) / 2, tz); tower.castShadow = true; scene.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 5, 10), roofMat);
    roof.position.set(tx, wallH + 4 + 2.5, tz); scene.add(roof);
    // Tower crenellations
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) continue;
      const ang = (i / 6) * Math.PI * 2;
      const tc = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), crenMat);
      tc.position.set(tx + Math.cos(ang) * 5, wallH + 4 + 0.75, tz + Math.sin(ang) * 5);
      scene.add(tc);
    }
  });

  // Pond
  const pondBed = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 1.0 }));
  pondBed.rotation.x = -Math.PI / 2; pondBed.position.set(-35, -0.05, -30); scene.add(pondBed);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2277aa, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.82 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(-35, 0.02, -30); scene.add(water);
  const pondRockMat = new THREE.MeshStandardMaterial({ color: 0x777770, roughness: 0.95 });
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const r = 7.8 + Math.random() * 0.6;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.35, 0), pondRockMat);
    rock.position.set(-35 + Math.cos(ang) * r, 0.1, -30 + Math.sin(ang) * r);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true; scene.add(rock);
  }

  // Scattered rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.95 });
  for (let i = 0; i < 25; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.3, 0), rockMat);
    rock.position.set((Math.random() - 0.5) * 260, 0.1, (Math.random() - 0.5) * 260);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true; scene.add(rock);
  }

  let waterTime = 0;
  const waterUpdate = (dt) => {
    waterTime += dt;
    waterMat.color.setHSL(0.57 + Math.sin(waterTime * 0.5) * 0.02, 0.7, 0.35 + Math.sin(waterTime * 0.8) * 0.03);
  };

  return { sun, ambient, ground, waterUpdate, pondPosition: { x: -35, z: -30 } };
}