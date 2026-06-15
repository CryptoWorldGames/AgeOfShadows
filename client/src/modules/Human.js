import * as THREE from 'three';
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

function playSound(type, listenerPos, soundPos) {
  try {
    const ctx = getAudioCtx();
    const dx = soundPos.x - listenerPos.x;
    const dz = soundPos.z - listenerPos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    const vol = Math.max(0, 1 - dist / 30) * 0.25;
    if (vol <= 0.01) return;
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
  // Auto-task type — remembers what task type was assigned
  let autoTask = null; // 'chop' | 'stone' | 'gold' | 'animal' | null

  let moving = false; let walkClock = 0; let chopPhase = 0;
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
    if (prevPhase < 0.55 && chopPhase >= 0.55) {
      tgt.takeDamage(1);
      const cam = world.camera;
      const lp = cam ? { x: cam.position.x, z: cam.position.z } : { x: 0, z: 0 };
      playSound(soundType, lp, group.position);
      onHit();
    }
    if (chopPhase >= 1) { chopPhase = 0; }
  }

  // ===== AUTO-TASK: find nearest resource of same type =====
  function findNearest(world, type) {
    const me = group.position;
    let best = null, bestDist = Infinity;
    const list = type === 'chop' ? world.trees : type === 'stone' ? world.stones : type === 'gold' ? world.golds : [];
    list.forEach((r) => {
      if (r.isDepleted()) return;
      const p = r.position();
      const d = Math.sqrt((p.x-me.x)**2 + (p.z-me.z)**2);
      if (d < bestDist) { bestDist = d; best = r; }
    });
    return best;
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
      if (chopTarget.isDepleted()) {
        // Auto-task: find next tree
        const next = findNearest(world, 'chop');
        if (next) { chopTarget=next; chopSlot=null; chopPhase=0; woodHitCount=0; }
        else { chopTarget=null; chopSlot=null; }
      } else {
        const tp = chopTarget.position(); const st = chopTarget.state(); const dTree = distTo(tp.x,tp.z);
        if (st === 'woodpile') {
          if (chopTarget.woodRemaining() > 0) {
            if (dTree <= gatherRange) {
              frozen=true; faceToward(tp.x,tp.z); gatherTimer+=dt;
              if (gatherTimer >= S.tree.pickupInterval) { gatherTimer=0; const got=chopTarget.takeWood(1); if (world.resources) world.resources.wood+=got; }
            } else { moveToward(chopSlot||tp,dt,0.15); moving=true; }
          } else {
            // Wood all picked up — find next tree
            const next = findNearest(world, 'chop');
            if (next) { chopTarget=next; chopSlot=null; chopPhase=0; woodHitCount=0; }
            else { chopTarget=null; chopSlot=null; }
          }
        } else {
          if (dTree <= chopRange) {
            frozen=true; faceToward(tp.x,tp.z);
            if (st === 'standing') {
              swingPose(dt, chopTarget, 'chop', world, () => {
                woodHitCount++;
                if (woodHitCount >= S.tree.hitsPerResource) { woodHitCount=0; if (world.resources) world.resources.wood+=1; }
              });
            }
          } else { moveToward(chopSlot||tp,dt,0.15); moving=true; }
        }
      }
    }
    // Stone
    else if (stoneTarget) {
      if (stoneTarget.isDepleted()) {
        const next = findNearest(world, 'stone');
        if (next) { stoneTarget=next; stoneSlot=null; chopPhase=0; stoneHitCount=0; }
        else { stoneTarget=null; stoneSlot=null; }
      } else {
        const sp = stoneTarget.position(); const st = stoneTarget.state(); const dStone = distTo(sp.x,sp.z);
        if (st === 'pile') {
          const next = findNearest(world, 'stone');
          if (next) { stoneTarget=next; stoneSlot=null; chopPhase=0; stoneHitCount=0; }
          else { stoneTarget=null; stoneSlot=null; }
        } else {
          if (dStone <= chopRange) {
            frozen=true; faceToward(sp.x,sp.z);
            if (st === 'standing') {
              swingPose(dt, stoneTarget, 'mine', world, () => {
                stoneHitCount++;
                if (stoneHitCount >= S.stone.hitsPerResource) { stoneHitCount=0; if (world.resources) world.resources.stone+=1; }
              });
            }
          } else { moveToward(stoneSlot||sp,dt,0.15); moving=true; }
        }
      }
    }
    // Gold
    else if (goldTarget) {
      if (goldTarget.isDepleted()) {
        const next = findNearest(world, 'gold');
        if (next) { goldTarget=next; goldSlot=null; chopPhase=0; goldHitCount=0; }
        else { goldTarget=null; goldSlot=null; }
      } else {
        const gp = goldTarget.position(); const st = goldTarget.state(); const dGold = distTo(gp.x,gp.z);
        if (st === 'pile') {
          const next = findNearest(world, 'gold');
          if (next) { goldTarget=next; goldSlot=null; chopPhase=0; goldHitCount=0; }
          else { goldTarget=null; goldSlot=null; }
        } else {
          if (dGold <= chopRange) {
            frozen=true; faceToward(gp.x,gp.z);
            if (st === 'standing') {
              swingPose(dt, goldTarget, 'mine', world, () => {
                goldHitCount++;
                if (goldHitCount >= S.gold.hitsPerResource) { goldHitCount=0; if (world.resources) world.resources.gold+=1; }
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
    moveTo(v) { target=v.clone(); chopTarget=null; chopSlot=null; animalTarget=null; animalSlot=null; stoneTarget=null; stoneSlot=null; goldTarget=null; goldSlot=null; chopPhase=0; stoneHitCount=0; goldHitCount=0; woodHitCount=0; autoTask=null; },
    chopTree(tree,slot) { chopTarget=tree; chopSlot=slot||null; animalTarget=null; stoneTarget=null; goldTarget=null; target=null; chopPhase=0; woodHitCount=0; autoTask='chop'; },
    killAnimal(animal,slot) { animalTarget=animal; animalSlot=slot||null; chopTarget=null; stoneTarget=null; goldTarget=null; target=null; chopPhase=0; autoTask='animal'; },
    mineStone(stone,slot) { stoneTarget=stone; stoneSlot=slot||null; chopTarget=null; animalTarget=null; goldTarget=null; target=null; chopPhase=0; stoneHitCount=0; autoTask='stone'; },
    mineGold(gold,slot) { goldTarget=gold; goldSlot=slot||null; chopTarget=null; animalTarget=null; stoneTarget=null; target=null; chopPhase=0; goldHitCount=0; autoTask='gold'; },
    stop() { target=null; chopTarget=null; chopSlot=null; animalTarget=null; animalSlot=null; stoneTarget=null; stoneSlot=null; goldTarget=null; goldSlot=null; autoTask=null; },
    update, animate() {}
  };

  return unit;
}