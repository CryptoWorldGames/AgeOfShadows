// C:\Users\mycry\games\AgeOfShadows\client\src\modules\Human.js
import * as THREE from 'three';

export function createHuman(scene, position = { x: 0, y: 0, z: 0 }) {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);

  // Body
  const bodyGeometry = new THREE.BoxGeometry(0.8, 2, 0.6);
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff9999 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.4, 32, 32);
  const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 2.6;
  group.add(head);

  // Left arm
  const armGeometry = new THREE.BoxGeometry(0.3, 1.5, 0.3);
  const armMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.6, 1.2, 0);
  group.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.6, 1.2, 0);
  group.add(rightArm);

  // Left leg
  const legGeometry = new THREE.BoxGeometry(0.3, 1.5, 0.3);
  const legMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.25, 0.25, 0);
  group.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.25, 0.25, 0);
  group.add(rightLeg);

  scene.add(group);

  return {
    group,
    body,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    animate: (time) => {
      // Simple walk animation
      leftArm.rotation.z = Math.sin(time * 2) * 0.3;
      rightArm.rotation.z = Math.sin(time * 2 + Math.PI) * 0.3;
      leftLeg.rotation.z = Math.sin(time * 2 + Math.PI) * 0.2;
      rightLeg.rotation.z = Math.sin(time * 2) * 0.2;
    }
  };
}