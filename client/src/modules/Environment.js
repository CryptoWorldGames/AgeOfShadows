// C:\Users\mycry\games\AgeOfShadows\client\src\modules\Environment.js
import * as THREE from 'three';

export function createEnvironment(scene) {
  // Sky
  scene.background = new THREE.Color(0x87ceeb);

  // Lighting
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Ground plane
  const groundGeometry = new THREE.PlaneGeometry(200, 200);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a7f5f });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Optional: Grid helper
  const gridHelper = new THREE.GridHelper(200, 40, 0x444444, 0x888888);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  return {
    directionalLight,
    ambientLight,
    ground,
    gridHelper
  };
}