import os

base = r'C:\Users\mycry\games\AgeOfShadows'
src = base + r'\client\src\modules'

files = {}

# ============================================================
# Settings.js
# ============================================================
files[src + r'\Settings.js'] = r"""export const SETTINGS = {
  tree: { hitsToKill: 10, hitsPerResource: 10, yield: 10, respawnTime: 3600 },
  stone: { hitsToKill: 200, hitsPerResource: 20, yield: 10, respawnTime: 7200 },
  gold: { hitsToKill: 400, hitsPerResource: 40, yield: 10, respawnTime: 10800 },
  chicken: { hitsToKill: 3, pickupInterval: 1, yield: 5, respawnTime: 3600, minOnMap: 5 },
  deer: { hitsToKill: 15, pickupInterval: 2, yield: 20, respawnTime: 7200 },
  water: { refillInterval: 10, bottleCapacity: 10, maxWater: 100 },
  drain: { foodInterval: 2160, waterInterval: 2160 },
  unit: {
    speed: 2.4, swingInterval: 0.7, chopRange: 1.8, gatherRange: 1.6,
    carryWood: 10, carryStone: 5, carryGold: 2, carryFood: 10
  },
  building: {
    townCenter: { woodCost: 100, stoneCost: 0, goldCost: 0, buildTime: 30, tearDownTime: 60, label: 'Town Center' },
    house: { woodCost: 100, stoneCost: 0, goldCost: 0, buildTime: 60, tearDownTime: 120, label: 'House', maxUnits: 10, storageMax: 1000, decayInterval: 3600 },
    woodFence: { woodCost: 10, stoneCost: 0, goldCost: 0, buildTime: 60, hitsToDestroy: 25, label: 'Wood Fence' },
    stoneFence: { woodCost: 0, stoneCost: 50, goldCost: 0, buildTime: 120, hitsToDestroy: 100, label: 'Stone Fence' },
    farm: { woodCost: 40, stoneCost: 0, goldCost: 0, buildTime: 15, label: 'Farm' },
    lumberMill: { woodCost: 80, stoneCost: 10, goldCost: 0, buildTime: 25, label: 'Lumber Mill' },
    mine: { woodCost: 60, stoneCost: 30, goldCost: 0, buildTime: 40, label: 'Mine' },
    barracks: { woodCost: 100, stoneCost: 50, goldCost: 20, buildTime: 60, label: 'Barracks' },
    tower: { woodCost: 50, stoneCost: 60, goldCost: 10, buildTime: 45, label: 'Watch Tower' },
    market: { woodCost: 80, stoneCost: 40, goldCost: 30, buildTime: 50, label: 'Market' },
    blacksmith: { woodCost: 60, stoneCost: 80, goldCost: 50, buildTime: 60, label: 'Blacksmith' }
  },
  garden: { seedCost: 1, yield: 100, tickInterval: 300, size: 10 },
  healing: { hpPerMin: 1.67 },
  loot: { groundExpiry: 86400 },
  animal: {
    chicken: { wanderSpeed: 0.8, wanderRange: 15, respawnTime: 3600 },
    deer: { wanderSpeed: 3.5, wanderRange: 40, canKill: true }
  },
  spawn: { trees: 20, chickens: 5, deer: 4, stoneDeposits: 8, goldDeposits: 4 },
  weapons: { axe: { label: 'Axe', damage: 1, attackInterval: 0.7, available: true } }
};"""

# ============================================================
# Human.js
# ============================================================
files[src + r'\Human.js'] = r"""import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SETTINGS } from './Settings.js';

const MODEL_URL = '/models/balkan__cs2_agent_model_dragomir_no1.glb';
const SKIN_MATS = ['tm_balkan_v2_head_varianta.001'];

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSound(type, listenerPos, soundPos, camera) {
  try {
    const ctx = getAudioCtx();
    // Distance-based volume
    const dx = soundPos.x - listenerPos.x;
    const dz = soundPos.z - listenerPos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    const maxDist = 30;
    const vol = Math.max(0, 1 - dist / maxDist) * 0.25;
    if (vol <= 0.01) return; // too far, silent

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(vol, now);
    gainNode.connect(ctx.destination);

    if (type === 'chop') {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now); osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
      g.gain.setValueAtTime(1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g); g.connect(gainNode); osc.start(now); osc.stop(now + 0.16);
    } else if (type === 'mine') {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      g.gain.setValueAtTime(1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(g); g.connect(gainNode); osc.start(now); osc.stop(now + 0.13);
    }
  } catch (e) {}
}

function makeHealthBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.16), new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false, transparent: true }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false, transparent: true }));
  fill.position.z = 0.001; g.add(bg); g.add(fill); g.renderOrder = 999;
  return { group: g, update(frac) { frac = Math.max(0, Math.min(1, frac)); fill.scale.x = frac; fill.position.x = -(1-frac)*0.5; } };
}

function makeAxe() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }));
  handle.position.y = -0.35; handle.castShadow = true; g.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.35 }));
  head.position.set(0.13, -0.62, 0); head.castShadow = true; g.add(head);
  return g;
}

export const TEAM_COLORS = {
  neutral: null, red: new THREE.Color(1.8, 0.4, 0.4), blue: new THREE.Color(0.4, 0.5, 2.0),
  green: new THREE.Color(0.4, 1.6, 0.4), yellow: new THREE.Color(1.8, 1.5, 0.3),
  purple: new THREE.Color(1.4, 0.4, 1.8), orange: new THREE.Color(2.0, 0.8, 0.2)
};

export function createHuman(scene, position = { x: 0, y: 0, z: 0 }, options = {}) {
  const team = options.team || 'neutral';
  const teamTint = TEAM_COLORS[team] || null;

  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  scene.add(group);

  const modelHolder = new THREE.Group(); group.add(modelHolder);
  const axeHolder = new THREE.Group(); axeHolder.add(makeAxe()); modelHolder.add(axeHolder);
  const healthBar = makeHealthBar(); healthBar.group.position.y = 2.3; group.add(healthBar.group);

  let modelCenterY = 1.0;
  const B = {}; const rest = {}; let handR = null;
  const handWorld = new THREE.Vector3();

  const loader = new GLTFLoader();
  loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    model.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true; c.receiveShadow = true;
        if (c.material && teamTint) {
          const matName = c.material.name || '';
          const isSkin = SKIN_MATS.some((s) => matName.includes(s));
          if (!isSkin) { c.material = c.material.clone(); c.material.color.multiply(teamTint); }
        }
      }
    });
    modelHolder.add(model);
    const bbox = new THREE.Box3().setFromObject(model);
    modelCenterY = (bbox.min.y + bbox.max.y) / 2;
    const want = { legUL:'leg_upper_l_65', legLL:'leg_lower_l_63', legUR:'leg_upper_r_70', legLR:'leg_lower_r_68', armUL:'arm_upper_l_28', armUR:'arm_upper_r_55', spine:'spine_2_58' };
    model.traverse((o) => {
      if (!o.isBone) return;
      for (const key in want) { if (o.name === want[key]) { B[key] = o; rest[key] = o.rotation.clone(); } }
      if (o.name === 'hand_r_49') handR = o;
    });
  }, undefined, (err) => console.error('Failed to load character:', err));

  let target = null;
  let chopTarget = null; let chopSlot = null;
  let animalTarget = null; let animalSlot = null;
  let stoneTarget = null; let stoneSlot = null;
  let goldTarget = null; let goldSlot = null;
  let moving = false; let walkClock = 0; let chopPhase = 0;
  let swingFired = false; // prevent double-fire per swing
  let stoneHitCount = 0; let goldHitCount = 0; let woodHitCount = 0;
  let gatherTimer = 0; let chopActive = false; let frozen = false;
  let waterDrainTimer = 0; let foodDrainTimer = 0; let waterRefillTimer = 0;

  const S = SETTINGS;
  const radius = 0.5;
  const speed = S.unit.speed;
  const chopRange = S.unit.chopRange;
  const gatherRange = S.unit.gatherRange;
  const swingInterval = S.unit.swingInterval;
  const axeRestRot = { x: 0.5, y: 0, z: 0.2 };
  let axeRot = { x: 0.5, y: 0, z: 0.2 };

  function resetPose() { for (const key in B) { if (rest[key]) B[key].rotation.copy(rest[key]); } }
  function distTo(x, z) { const dx = x-group.position.x, dz = z-group.position.z; return Math.sqrt(dx*dx+dz*dz); }
  function faceToward(tx, tz) {
    const dx = tx-group.position.x, dz = tz-group.position.z;
    if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) modelHolder.rotation.y = Math.atan2(dx, dz);
  }
  function moveToward(dest, dt, stopDist) {
    const me = group.position;
    let dx = dest.x-me.x, dz = dest.z-me.z;
    const dist = Math.sqrt(dx*dx+dz*dz);
    if (dist <= stopDist) return true;
    dx /= dist; dz /= dist;
    const step = Math.min(speed*dt, dist-stopDist);
    me.x += dx*step; me.z += dz*step;
    faceToward(me.x+dx*10, me.z+dz*10);
    return false;
  }
  function separate(world) {
    if (frozen) return;
    const me = group.position;
    world.units.forEach((o) => {
      if (o === unit) return;
      let dx = me.x-o.group.position.x, dz = me.z-o.group.position.z;
      const dist = Math.sqrt(dx*dx+dz*dz);
      const minD = radius+o.radius;
      if (dist > 1e-4 && dist < minD) { const push=(minD-dist)*0.5; me.x+=(dx/dist)*push; me.z+=(dz/dist)*push; }
    });
  }
  function walkPose(dt) {
    walkClock += dt*7; const s = Math.sin(walkClock);
    if (B.legUL) B.legUL.rotation.x = rest.legUL.x + s*0.5;
    if (B.legUR) B.legUR.rotation.x = rest.legUR.x - s*0.5;
    if (B.legLL) B.legLL.rotation.x = rest.legLL.x + Math.max(0,-s)*0.6;
    if (B.legLR) B.legLR.rotation.x = rest.legLR.x + Math.max(0,s)*0.6;
    if (B.armUL) B.armUL.rotation.x = rest.armUL.x - s*0.35;
    if (B.armUR) B.armUR.rotation.x = rest.armUR.x + s*0.35;
    modelHolder.position.y = Math.abs(Math.sin(walkClock))*0.04;
  }

  function swingPose(dt, tgt, soundType, world, onHit) {
    chopActive = true;
    const prevPhase = chopPhase;
    chopPhase += dt / swingInterval;
    const p = chopPhase;
    let armA;
    if (p < 0.55) armA = (p/0.55)*-1.8; else armA = -1.8+((p-0.55)/0.45)*2.3;
    if (B.armUR) B.armUR.rotation.x = rest.armUR.x + armA;
    if (B.spine) B.spine.rotation.x = rest.spine.x + Math.min(0,armA+0.8)*0.2;
    if (p < 0.55) { const t=p/0.55; axeRot.x=0.5-2.1*t; axeRot.z=0.2+0.6*t; }
    else { const t=(p-0.55)/0.45; axeRot.x=-1.6+2.1*t; axeRot.z=0.8-1.4*t; }

    // Fire exactly once at peak of swing (phase crosses 0.55)
    if (prevPhase < 0.55 && chopPhase >= 0.55) {
      tgt.takeDamage(1);
      const cam = world.camera;
      const lp = cam ? { x: cam.position.x, z: cam.position.z } : { x: 0, z: 0 };
      playSound(soundType, lp, group.position, cam);
      onHit();
    }

    if (chopPhase >= 1) { chopPhase = 0; }
  }

  function update(dt, world) {
    resetPose();
    moving = false; chopActive = false; frozen = false;

    waterDrainTimer += dt;
    if (waterDrainTimer >= S.drain.waterInterval) { waterDrainTimer=0; if (world.resources.water>0) world.resources.water=Math.max(0,world.resources.water-1); }
    foodDrainTimer += dt;
    if (foodDrainTimer >= S.drain.foodInterval) { foodDrainTimer=0; if (world.resources.food>0) world.resources.food=Math.max(0,world.resources.food-1); }

    if (world.pondPosition) {
      const dPond = distTo(world.pondPosition.x, world.pondPosition.z);
      if (dPond <= 9.0 && world.resources.water < 100) {
        waterRefillTimer += dt;
        if (waterRefillTimer >= S.water.refillInterval) { waterRefillTimer=0; world.resources.water=Math.min(100,world.resources.water+1); }
      } else waterRefillTimer=0;
    }

    // Animal
    if (animalTarget) {
      if (animalTarget.isDepleted()) { animalTarget=null; animalSlot=null; }
      else {
        const ap = animalTarget.position(); const st = animalTarget.state();
        if (st === 'meatpile') {
          if (animalTarget.foodRemaining() > 0) {
            if (distTo(ap.x,ap.z) <= gatherRange) {
              frozen=true; faceToward(ap.x,ap.z); gatherTimer+=dt;
              if (gatherTimer >= S.chicken.pickupInterval) { gatherTimer=0; const got=animalTarget.takeFood(1); if (world.resources) world.resources.food+=got; }
            } else { moveToward(animalSlot||ap,dt,0.8); moving=true; }
          } else { animalTarget=null; animalSlot=null; }
        } else if (st === 'wandering') {
          if (distTo(ap.x,ap.z) <= chopRange) {
            frozen=true; faceToward(ap.x,ap.z);
            swingPose(dt, animalTarget, 'chop', world, () => {});
          } else { moveToward(animalSlot||ap,dt,0.15); moving=true; }
        } else { frozen=true; faceToward(ap.x,ap.z); }
      }
    }
    // Tree
    else if (chopTarget) {
      if (chopTarget.isDepleted()) { chopTarget=null; chopSlot=null; }
      else {
        const tp = chopTarget.position(); const st = chopTarget.state(); const dTree = distTo(tp.x,tp.z);
        if (st === 'woodpile') {
          if (chopTarget.woodRemaining() > 0) {
            if (dTree <= gatherRange) {
              frozen=true; faceToward(tp.x,tp.z); gatherTimer+=dt;
              if (gatherTimer >= S.tree.pickupInterval) { gatherTimer=0; const got=chopTarget.takeWood(1); if (world.resources) world.resources.wood+=got; }
            } else { moveToward(chopSlot||tp,dt,0.15); moving=true; }
          } else { chopTarget=null; chopSlot=null; }
        } else {
          if (dTree <= chopRange) {
            frozen=true; faceToward(tp.x,tp.z);
            if (st === 'standing') {
              swingPose(dt, chopTarget, 'chop', world, () => {
                woodHitCount++;
                if (woodHitCount >= S.tree.hitsPerResource) {
                  woodHitCount=0;
                  if (world.resources) world.resources.wood+=1;
                }
              });
            }
          } else { moveToward(chopSlot||tp,dt,0.15); moving=true; }
        }
      }
    }
    // Stone
    else if (stoneTarget) {
      if (stoneTarget.isDepleted()) { stoneTarget=null; stoneSlot=null; }
      else {
        const sp = stoneTarget.position(); const st = stoneTarget.state(); const dStone = distTo(sp.x,sp.z);
        if (st === 'pile') {
          stoneTarget=null; stoneSlot=null; // done gathering
        } else {
          if (dStone <= chopRange) {
            frozen=true; faceToward(sp.x,sp.z);
            if (st === 'standing') {
              swingPose(dt, stoneTarget, 'mine', world, () => {
                stoneHitCount++;
                if (stoneHitCount >= S.stone.hitsPerResource) {
                  stoneHitCount=0;
                  if (world.resources) world.resources.stone+=1;
                }
              });
            }
          } else { moveToward(stoneSlot||sp,dt,0.15); moving=true; }
        }
      }
    }
    // Gold
    else if (goldTarget) {
      if (goldTarget.isDepleted()) { goldTarget=null; goldSlot=null; }
      else {
        const gp = goldTarget.position(); const st = goldTarget.state(); const dGold = distTo(gp.x,gp.z);
        if (st === 'pile') {
          goldTarget=null; goldSlot=null;
        } else {
          if (dGold <= chopRange) {
            frozen=true; faceToward(gp.x,gp.z);
            if (st === 'standing') {
              swingPose(dt, goldTarget, 'mine', world, () => {
                goldHitCount++;
                if (goldHitCount >= S.gold.hitsPerResource) {
                  goldHitCount=0;
                  if (world.resources) world.resources.gold+=1;
                }
              });
            }
          } else { moveToward(goldSlot||gp,dt,0.15); moving=true; }
        }
      }
    }
    else if (target) {
      const arrived = moveToward(target,dt,0.05);
      if (arrived) target=null; else moving=true;
    }

    if (moving) walkPose(dt); else modelHolder.position.y*=0.7;

    if (!chopActive) {
      axeRot.x += (axeRestRot.x-axeRot.x)*0.3;
      axeRot.y += (axeRestRot.y-axeRot.y)*0.3;
      axeRot.z += (axeRestRot.z-axeRot.z)*0.3;
    }

    separate(world);

    if (handR) {
      handR.getWorldPosition(handWorld);
      axeHolder.parent.worldToLocal(axeHolder.position.copy(handWorld));
      axeHolder.rotation.set(axeRot.x,axeRot.y,axeRot.z);
    }

    if (world.camera) healthBar.group.quaternion.copy(world.camera.quaternion);
    healthBar.update(unit.health/unit.maxHealth);
  }

  const unit = {
    group, type:'unit', team, radius,
    health:100, maxHealth:100, selected:false,
    getModelCenterY: () => modelCenterY,
    setSelected(b) { unit.selected=b; },
    moveTo(v) { target=v.clone(); chopTarget=null; chopSlot=null; animalTarget=null; animalSlot=null; stoneTarget=null; stoneSlot=null; goldTarget=null; goldSlot=null; chopPhase=0; stoneHitCount=0; goldHitCount=0; woodHitCount=0; },
    chopTree(tree,slot) { chopTarget=tree; chopSlot=slot||null; animalTarget=null; stoneTarget=null; goldTarget=null; target=null; chopPhase=0; woodHitCount=0; },
    killAnimal(animal,slot) { animalTarget=animal; animalSlot=slot||null; chopTarget=null; stoneTarget=null; goldTarget=null; target=null; chopPhase=0; },
    mineStone(stone,slot) { stoneTarget=stone; stoneSlot=slot||null; chopTarget=null; animalTarget=null; goldTarget=null; target=null; chopPhase=0; stoneHitCount=0; },
    mineGold(gold,slot) { goldTarget=gold; goldSlot=slot||null; chopTarget=null; animalTarget=null; stoneTarget=null; target=null; chopPhase=0; goldHitCount=0; },
    stop() { target=null; chopTarget=null; chopSlot=null; animalTarget=null; animalSlot=null; stoneTarget=null; stoneSlot=null; goldTarget=null; goldSlot=null; },
    update, animate() {}
  };

  return unit;
}"""

# ============================================================
# Write all files
# ============================================================
for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Wrote:', path)

# GameScene — written separately to avoid triple-quote issues
gamescene_content = (
    "import React, { useEffect, useRef } from 'react';\n"
    "import * as THREE from 'three';\n"
    "import { createEnvironment } from './modules/Environment';\n"
    "import { createHuman } from './modules/Human';\n"
    "import { createTree } from './modules/Tree';\n"
    "import { createUI } from './modules/UI';\n"
    "import { createControls } from './modules/Controls';\n"
    "import { createTownCenter } from './modules/Building';\n"
    "import { createChicken, createDeer } from './modules/Animal';\n"
    "import { createStone } from './modules/Stone';\n"
    "import { createGold } from './modules/Gold';\n"
    "export default function GameScene({ playerId, gameState }) {\n"
    "  const containerRef = useRef(null);\n"
    "  useEffect(() => {\n"
    "    if (!containerRef.current) return;\n"
    "    const scene = new THREE.Scene();\n"
    "    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);\n"
    "    camera.position.set(0, 25, 35);\n"
    "    camera.lookAt(0, 0, 0);\n"
    "    const renderer = new THREE.WebGLRenderer({ antialias: true });\n"
    "    renderer.setSize(window.innerWidth, window.innerHeight);\n"
    "    renderer.shadowMap.enabled = true;\n"
    "    renderer.shadowMap.type = THREE.PCFShadowMap;\n"
    "    containerRef.current.appendChild(renderer.domElement);\n"
    "    const env = createEnvironment(scene);\n"
    "    const ui = createUI(playerId, gameState);\n"
    "    const resources = { wood: 10000, food: 10000, water: 10000, gold: 10000, stone: 10000 };\n"
    "    const world = { camera, units: [], trees: [], buildings: [], animals: [], stones: [], golds: [], resources, ui, pondPosition: env.pondPosition };\n"
    "    world.units.push(createHuman(scene, { x: -8, y: 0, z: 8 }, { team: 'red' }));\n"
    "    world.units.push(createHuman(scene, { x: 8, y: 0, z: 8 }, { team: 'blue' }));\n"
    "    const usedSpots = [];\n"
    "    function isTooClose(x, z, minDist) { return usedSpots.some((s) => Math.sqrt((x-s.x)**2+(z-s.z)**2) < minDist); }\n"
    "    function addSpot(x, z) { usedSpots.push({ x, z }); }\n"
    "    let attempts = 0;\n"
    "    while (world.trees.length < 20 && attempts < 300) {\n"
    "      attempts++;\n"
    "      const x = (Math.random()-0.5)*120; const z = (Math.random()-0.5)*120;\n"
    "      if (Math.sqrt(x*x+z*z) < 12) continue;\n"
    "      if (isTooClose(x, z, 5)) continue;\n"
    "      addSpot(x, z); world.trees.push(createTree(scene, { x, y:0, z }));\n"
    "    }\n"
    "    attempts = 0;\n"
    "    while (world.stones.length < 8 && attempts < 300) {\n"
    "      attempts++;\n"
    "      const x = (Math.random()-0.5)*120; const z = (Math.random()-0.5)*120;\n"
    "      if (Math.sqrt(x*x+z*z) < 15) continue;\n"
    "      if (isTooClose(x, z, 8)) continue;\n"
    "      addSpot(x, z); world.stones.push(createStone(scene, { x, y:0, z }));\n"
    "    }\n"
    "    attempts = 0;\n"
    "    while (world.golds.length < 4 && attempts < 300) {\n"
    "      attempts++;\n"
    "      const angle = Math.random()*Math.PI*2;\n"
    "      const r = 15 + Math.random()*30;\n"
    "      const x = Math.cos(angle)*r; const z = Math.sin(angle)*r;\n"
    "      if (isTooClose(x, z, 10)) continue;\n"
    "      addSpot(x, z); world.golds.push(createGold(scene, { x, y:0, z }));\n"
    "    }\n"
    "    // Small test gold deposit right next to TC\n"
    "    world.golds.push(createGold(scene, { x: 5, y:0, z: 5 }));\n"
    "    const startTC = createTownCenter(scene, false);\n"
    "    startTC.setPosition(0, 0); startTC.place(); world.buildings.push(startTC);\n"
    "    world.animals.push(createChicken(scene, { x:6, y:0, z:6 }));\n"
    "    world.animals.push(createChicken(scene, { x:-6, y:0, z:6 }));\n"
    "    world.animals.push(createChicken(scene, { x:6, y:0, z:-6 }));\n"
    "    world.animals.push(createChicken(scene, { x:-6, y:0, z:-6 }));\n"
    "    world.animals.push(createChicken(scene, { x:0, y:0, z:8 }));\n"
    "    for (let i = 0; i < 4; i++) {\n"
    "      const ang = (i/4)*Math.PI*2; const r = 35+Math.random()*15;\n"
    "      world.animals.push(createDeer(scene, { x:Math.cos(ang)*r, y:0, z:Math.sin(ang)*r }));\n"
    "    }\n"
    "    const { update, dispose } = createControls(camera, renderer, scene, world);\n"
    "    let last = performance.now(); let time = 0;\n"
    "    const animate = () => {\n"
    "      requestAnimationFrame(animate);\n"
    "      const now = performance.now(); let dt = (now-last)/1000; last = now;\n"
    "      if (dt > 0.1) dt = 0.1; time += dt;\n"
    "      update(time, dt);\n"
    "      if (env.waterUpdate) env.waterUpdate(dt);\n"
    "      world.trees.forEach((t) => t.update(dt));\n"
    "      world.stones.forEach((s) => s.update(dt));\n"
    "      world.golds.forEach((g) => g.update(dt));\n"
    "      world.animals.forEach((a) => a.update(dt, world));\n"
    "      world.units.forEach((u) => { u.update(dt, world); u.animate(dt); });\n"
    "      ui.setResources(resources);\n"
    "      renderer.render(scene, camera);\n"
    "    };\n"
    "    animate();\n"
    "    const handleResize = () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };\n"
    "    window.addEventListener('resize', handleResize);\n"
    "    return () => {\n"
    "      window.removeEventListener('resize', handleResize); dispose();\n"
    "      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) containerRef.current.removeChild(renderer.domElement);\n"
    "    };\n"
    "  }, [playerId]);\n"
    "  return React.createElement('div', { ref: containerRef, style: { width:'100%', height:'100vh', overflow:'hidden' } });\n"
    "}\n"
)

gamescene_path = base + r'\client\src\GameScene.js'
with open(gamescene_path, 'w', encoding='utf-8') as f:
    f.write(gamescene_content)
print('Wrote:', gamescene_path)
print('\nAll done!')