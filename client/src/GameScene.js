import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createEnvironment } from './modules/Environment';
import { createHuman } from './modules/Human';
import { createUI } from './modules/UI';
import { createControls } from './modules/Controls';
export default function GameScene({ playerId, gameState }) {
const containerRef = useRef(null);
const sceneRef = useRef(null);
const humanRef = useRef(null);
const raycasterRef = useRef(new THREE.Raycaster());
const mouseRef = useRef(new THREE.Vector2());
useEffect(() => {
if (!containerRef.current) return;
const scene = new THREE.Scene();
sceneRef.current = scene;
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 15);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
containerRef.current.appendChild(renderer.domElement);
createEnvironment(scene);
const human = createHuman(scene, { x: 0, y: 0, z: 0 });
humanRef.current = human;
const { update: updateControls } = createControls(camera);
createUI(playerId, gameState);
const onMouseClick = (event) => {
mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
raycasterRef.current.setFromCamera(mouseRef.current, camera);
const intersects = raycasterRef.current.intersectObject(humanRef.current.group, true);
if (intersects.length > 0) {
console.log('Human clicked!');
humanRef.current.group.scale.set(1.1, 1.1, 1.1);
setTimeout(() => { humanRef.current.group.scale.set(1, 1, 1); }, 200);
}
};
window.addEventListener('click', onMouseClick);
let time = 0;
const animate = () => {
requestAnimationFrame(animate);
time += 0.016;
updateControls();
if (humanRef.current) humanRef.current.animate(time);
renderer.render(scene, camera);
};
animate();
const handleResize = () => {
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', handleResize);
return () => {
window.removeEventListener('resize', handleResize);
window.removeEventListener('click', onMouseClick);
if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
containerRef.current.removeChild(renderer.domElement);
}
};
}, [playerId]);
return React.createElement('div', { ref: containerRef, style: { width: '100%', height: '100vh' } });
}