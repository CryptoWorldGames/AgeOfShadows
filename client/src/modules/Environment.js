// C:\Users\mycry\games\AgeOfShadows\client\src\modules\Environment.js
import * as THREE from 'three';

export function createEnvironment(scene) {
  // Sky
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0xb0d8f0, 90, 230);

  // Sunlight
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(60, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xc8e0ff, 0.55);
  scene.add(ambient);

  const loader = new THREE.TextureLoader();

  // Real photo grass texture (CC0 from ambientCG)
  const grassUrl = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/grass_path_2/grass_path_2_diff_1k.jpg';
  const grassTex = loader.load(grassUrl);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(20, 20);

  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.9,
    metalness: 0.0
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300, 1, 1),
    grassMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Dirt path overlay — a long winding strip of dirt
  const dirtUrl = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dirt_road_2/dirt_road_2_diff_1k.jpg';
  const dirtTex = loader.load(dirtUrl);
  dirtTex.wrapS = THREE.RepeatWrapping;
  dirtTex.wrapT = THREE.RepeatWrapping;
  dirtTex.repeat.set(1, 8);

  // Main dirt trail (long strip)
  const pathMat = new THREE.MeshStandardMaterial({
    map: dirtTex,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.85
  });
  const path1 = new THREE.Mesh(new THREE.PlaneGeometry(5, 120), pathMat);
  path1.rotation.x = -Math.PI / 2;
  path1.position.set(0, 0.01, 0);
  scene.add(path1);

  // Cross path
  const path2 = new THREE.Mesh(new THREE.PlaneGeometry(120, 5), pathMat);
  path2.rotation.x = -Math.PI / 2;
  path2.position.set(0, 0.01, -20);
  scene.add(path2);

  // Diagonal path
  const path3 = new THREE.Mesh(new THREE.PlaneGeometry(4, 90), pathMat);
  path3.rotation.x = -Math.PI / 2;
  path3.rotation.z = Math.PI / 5;
  path3.position.set(30, 0.01, 20);
  scene.add(path3);

  // Small rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.95 });
  for (let i = 0; i < 25; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.3, 0),
      rockMat
    );
    rock.position.set(
      (Math.random() - 0.5) * 160,
      0.1,
      (Math.random() - 0.5) * 160
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  return { sun, ambient, ground };
}