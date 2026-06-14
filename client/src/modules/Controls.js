// C:\Users\mycry\games\AgeOfShadows\client\src\modules\Controls.js
import * as THREE from 'three';

export function createControls(camera) {
  const keys = {};
  const speed = 0.5;

  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  const update = () => {
    if (keys['w']) camera.position.z -= speed;
    if (keys['s']) camera.position.z += speed;
    if (keys['a']) camera.position.x -= speed;
    if (keys['d']) camera.position.x += speed;
    if (keys['q']) camera.position.y += speed;
    if (keys['e']) camera.position.y -= speed;
  };

  return {
    update,
    keys
  };
}