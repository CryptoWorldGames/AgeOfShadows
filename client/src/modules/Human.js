import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SETTINGS } from './Settings.js';

const MODEL_URL = 'https://pub-9e79279ca165496da153d64ecb88f99c.r2.dev/balkan__cs2_agent_model_dragomir_no1.glb';
const SKIN_MATS = ['tm_balkan_v2_head_varianta.001'];

let audioCtx = null;
// Resolve a world object's position whether it exposes position() as a method
// (buildings), getPosition() (legacy), a Vector3 property, or .group.position.
function resolvePos(obj) {
  if (!obj) return null;
  if (typeof obj.position === 'function') return obj.position();
  if (typeof obj.getPosition === 'function') return obj.getPosition();
  if (obj.position && typeof obj.position.x === 'number') return obj.position;
  if (obj.group && obj.group.position) return obj.group.position;
  return null;
}
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playSound(type, listenerPos, soundPos) {
  if (typeof window !== 'undefined' && window.__AOS_MUTED) return; // master mute
  try {
    const ctx = getAudioCtx();
    const dx = soundPos.x - listenerPos.x;
    const dz = soundPos.z - listenerPos.z;
    const vol = Math.max(0, 1 - Math.sqrt(dx*dx+dz*dz) / 30) * 0.25;
    if (vol <= 0.01) return;
    const now = ctx.currentTime;
    const gn = ctx.createGain(); gn.gain.setValueAtTime(vol, now); gn.connect(ctx.destination);
    if (type === 'chop') {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type='sawtooth'; osc.frequency.setValueAtTime(160,now); osc.frequency.exponentialRampToValueAtTime(55,now+0.08);
      g.gain.setValueAtTime(1,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      osc.connect(g); g.connect(gn); osc.start(now); osc.stop(now+0.16);
    } else if (type === 'mine') {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type='square'; osc.frequency.setValueAtTime(120,now); osc.frequency.exponentialRampToValueAtTime(40,now+0.1);
      g.gain.setValueAtTime(1,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
      osc.connect(g); g.connect(gn); osc.start(now); osc.stop(now+0.13);
    }
  } catch(e) {}
}

function makeHealthBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.16), new THREE.MeshBasicMaterial({color:0x222222,depthTest:false,transparent:true}));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.12), new THREE.MeshBasicMaterial({color:0xff3333,depthTest:false,transparent:true}));
  fill.position.z=0.001; g.add(bg); g.add(fill); g.renderOrder=999;
  return { group:g, update(frac) { frac=Math.max(0,Math.min(1,frac)); fill.scale.x=frac; fill.position.x=-(1-frac)*0.5; } };
}
function makeAxe() {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.7,6), new THREE.MeshStandardMaterial({color:0x5a3a1a,roughness:0.9}));
  h.position.y=-0.35; h.castShadow=true; g.add(h);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.16,0.06), new THREE.MeshStandardMaterial({color:0x999999,metalness:0.6,roughness:0.35}));
  hd.position.set(0.13,-0.62,0); hd.castShadow=true; g.add(hd);
  return g;
}

export const TEAM_COLORS = {
  neutral:null, red:new THREE.Color(1.8,0.4,0.4), blue:new THREE.Color(0.4,0.5,2.0),
  green:new THREE.Color(0.4,1.6,0.4), yellow:new THREE.Color(1.8,1.5,0.3),
  purple:new THREE.Color(1.4,0.4,1.8), orange:new THREE.Color(2.0,0.8,0.2)
};

export function createHuman(scene, position={x:0,y:0,z:0}, options={}) {
  const team = options.team||'neutral';
  const teamTint = TEAM_COLORS[team]||null;

  const group = new THREE.Group();
  group.position.set(position.x,0,position.z);
  scene.add(group);

  const modelHolder = new THREE.Group(); group.add(modelHolder);
  const axeHolder = new THREE.Group(); axeHolder.add(makeAxe()); modelHolder.add(axeHolder);
  const healthBar = makeHealthBar(); healthBar.group.position.y=2.3; healthBar.group.visible=false; group.add(healthBar.group);

  let modelCenterY=1.0;
  const B={}; const rest={}; let handR=null;
  const handWorld = new THREE.Vector3();

  const loader = new GLTFLoader();
  loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    model.traverse((c) => {
      if (c.isMesh) {
        c.castShadow=true; c.receiveShadow=true;
        // Force all materials visible — CS2 models have transparency issues
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((mat) => {
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
            mat.visible = true;
            mat.needsUpdate = true;
            if (teamTint) {
              const mn = mat.name||'';
              const isSkin = SKIN_MATS.some((s)=>mn.includes(s));
              if (!isSkin) { mat = mat.clone(); mat.color.multiply(teamTint); }
            }
          });
        }
      }
    });
    modelHolder.add(model);
    const bbox = new THREE.Box3().setFromObject(model);
    modelCenterY = (bbox.min.y+bbox.max.y)/2;
    const want = {legUL:'leg_upper_l_65',legLL:'leg_lower_l_63',legUR:'leg_upper_r_70',legLR:'leg_lower_r_68',armUL:'arm_upper_l_28',armUR:'arm_upper_r_55',spine:'spine_2_58'};
    model.traverse((o) => {
      if (!o.isBone) return;
      for (const k in want) { if (o.name===want[k]) { B[k]=o; rest[k]=o.rotation.clone(); } }
      if (o.name==='hand_r_49') handR=o;
    });
    // The model ships in a T-pose (arms straight out). Rotate the upper arms DOWN
    // so they hang at the sides. The model's arms extend along Z, so the "down"
    // rotation is about the X axis; this becomes the rest pose for idle AND walk.
    const ARM_DOWN = 1.25;
    if (B.armUL) { rest.armUL.x += ARM_DOWN; rest.armUL.z += 0.15; }
    if (B.armUR) { rest.armUR.x += ARM_DOWN; rest.armUR.z -= 0.15; }
    console.log('[rig] bones found:', Object.keys(B).join(',') || 'NONE', '| handR:', !!handR);
  }, undefined, (err)=>console.error('Failed to load character:',err));

  const inventory = {wood:0,stone:0,gold:0,food:0,water:0};
  const carryMax = SETTINGS.unit.carryMax;
  function carryTotal() { return Object.values(inventory).reduce((a,b)=>a+b,0); }
  function isFull() { return carryTotal()>=carryMax; }

  // Stats tracking for unit naming
  const lifetimeGathered = {wood:0,stone:0,gold:0,food:0,water:0};
  const spawnTime = Date.now();
  let hp = 100, hunger = 100, thirst = 100;

  function getUnitName() {
    const stats = lifetimeGathered;
    const max = Math.max(stats.wood, stats.stone, stats.gold, stats.food, stats.water);
    if (max === 0) return 'Worker';
    if (stats.wood === max) return 'Lumberjack';
    if (stats.food === max) return 'Hunter';
    if (stats.stone === max) return 'Stone Miner';
    if (stats.gold === max) return 'Gold Miner';
    if (stats.water === max) return 'Farmer';
    return 'Worker';
  }

  function getAliveTime() {
    const ms = Date.now() - spawnTime;
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hours}h ${m}m`;
  }

  let target=null;
  let chopTarget=null; let chopSlot=null;
  let animalTarget=null;
  let stoneTarget=null; let stoneSlot=null;
  let goldTarget=null; let goldSlot=null;
  let autoTask=null;
  let depositTarget=null;
  let returning=false;
  let lastKillPos=null;
  let huntSearchRadius=20;
  let huntAngle=0;

  let moving=false; let walkClock=0; let chopPhase=0;
  let serverPos=null;   // when set + world.serverDriven, this worker follows the server
  let stoneHitCount=0; let goldHitCount=0; let woodHitCount=0;
  let gatherTimer=0; let chopActive=false; let frozen=false;
  let waterDrainTimer=0; let foodDrainTimer=0; let waterRefillTimer=0;

  const S=SETTINGS;
  const radius=0.5;
  const speed=S.unit.speed;
  const chopRange=S.unit.chopRange;
  const gatherRange=S.unit.gatherRange;
  const swingInterval=S.unit.swingInterval;
  const axeRestRot={x:0.5,y:0,z:0.2};
  let axeRot={x:0.5,y:0,z:0.2};
  const spawnPos = new THREE.Vector3(position.x,0,position.z);

  function resetPose() { for (const k in B) { if (rest[k]) B[k].rotation.copy(rest[k]); } }
  function distTo(x,z) { const dx=x-group.position.x,dz=z-group.position.z; return Math.sqrt(dx*dx+dz*dz); }
  function faceToward(tx,tz) {
    const dx=tx-group.position.x,dz=tz-group.position.z;
    if (Math.abs(dx)>1e-4||Math.abs(dz)>1e-4) modelHolder.rotation.y=Math.atan2(dx,dz);
  }
  function moveToward(dest,dt,stopDist) {
    const me=group.position;
    let dx=dest.x-me.x,dz=dest.z-me.z;
    const dist=Math.sqrt(dx*dx+dz*dz);
    if (dist<=stopDist) return true;
    dx/=dist; dz/=dist;
    const step=Math.min(speed*dt,dist-stopDist);
    me.x+=dx*step; me.z+=dz*step;
    faceToward(me.x+dx*10,me.z+dz*10);
    return false;
  }
  // IMPROVEMENT #3: Optimized spatial collision with distance culling
  // Only check objects within reasonable range instead of all objects
  const SEPARATION_RANGE = 15; // Only check objects within 15 units
  let lastSeparationCheck = 0;

  function separate(world) {
    const me = group.position;
    // IMPROVEMENT #4: Reduce collision checks frequency - not every frame
    // Check every other frame for soft collisions (still every frame for hard)
    const checkFrequency = moving ? 1 : 2; // More frequent when moving
    lastSeparationCheck++;
    const shouldCheckSoft = (lastSeparationCheck % checkFrequency) === 0;

    const softPush = (ox, oz, or) => {
      let dx = me.x - ox, dz = me.z - oz;
      const distSq = dx * dx + dz * dz;
      const minD = radius + or;
      const minDSq = minD * minD;

      // IMPROVEMENT #5: Use squared distances to avoid expensive sqrt
      if (distSq > 1e-8 && distSq < minDSq) {
        const dist = Math.sqrt(distSq);
        const p = (minD - dist) * 0.5;
        me.x += (dx / dist) * p;
        me.z += (dz / dist) * p;
      }
    };

    if (!frozen && shouldCheckSoft) {
      // IMPROVEMENT #6: Spatial culling - only check nearby units
      const unitsInRange = (world.units || []).filter(o => {
        if (o === unit) return false;
        const dx = o.group.position.x - me.x;
        const dz = o.group.position.z - me.z;
        return dx * dx + dz * dz < SEPARATION_RANGE * SEPARATION_RANGE;
      });
      unitsInRange.forEach(o => softPush(o.group.position.x, o.group.position.z, o.radius));

      // Reduce iterations for trees/stones/gold/animals by filtering first
      const treesInRange = (world.trees || []).filter(t => {
        if (t === chopTarget) return false;
        const p = t.position();
        const dx = p.x - me.x, dz = p.z - me.z;
        return dx * dx + dz * dz < SEPARATION_RANGE * SEPARATION_RANGE;
      });
      treesInRange.forEach(t => { const p = t.position(); softPush(p.x, p.z, 0.9); });

      const stonesInRange = (world.stones || []).filter(s => {
        if (s === stoneTarget) return false;
        const p = s.position();
        const dx = p.x - me.x, dz = p.z - me.z;
        return dx * dx + dz * dz < SEPARATION_RANGE * SEPARATION_RANGE;
      });
      stonesInRange.forEach(s => { const p = s.position(); softPush(p.x, p.z, 1.0); });

      const goldsInRange = (world.golds || []).filter(g => {
        if (g === goldTarget) return false;
        const p = g.position();
        const dx = p.x - me.x, dz = p.z - me.z;
        return dx * dx + dz * dz < SEPARATION_RANGE * SEPARATION_RANGE;
      });
      goldsInRange.forEach(g => { const p = g.position(); softPush(p.x, p.z, 1.0); });

      const animalsInRange = (world.animals || []).filter(a => {
        if (a === animalTarget) return false;
        const p = a.position();
        const dx = p.x - me.x, dz = p.z - me.z;
        return dx * dx + dz * dz < SEPARATION_RANGE * SEPARATION_RANGE;
      });
      animalsInRange.forEach(a => { const p = a.position(); softPush(p.x, p.z, 0.5); });
    }

    // IMPROVEMENT #7: Hard building collision still runs every frame (important for pathfinding)
    const buildingsNearby = (world.buildings || []).filter(b => {
      if (b.isGhost) return true;
      const bp = resolvePos(b);
      if (!bp) return false;
      const dx = bp.x - me.x, dz = bp.z - me.z;
      return dx * dx + dz * dz < (SEPARATION_RANGE + 5) * (SEPARATION_RANGE + 5);
    });

    buildingsNearby.forEach(b => {
      if (b.isGhost) return;
      const bp = resolvePos(b);
      if (!bp) return;
      const ext = (b.radius || 3) * 0.75 + radius;
      let dx = me.x - bp.x, dz = me.z - bp.z;
      if (Math.abs(dx) < ext && Math.abs(dz) < ext) {
        const penX = ext - Math.abs(dx), penZ = ext - Math.abs(dz);
        if (penX < penZ) { me.x = bp.x + (dx >= 0 ? ext : -ext); }
        else { me.z = bp.z + (dz >= 0 ? ext : -ext); }
      }
    });
  }
  // Walk animation with frame-independent speed
  function walkPose(dt) {
    walkClock += dt * 7; // Frame-rate independent: dt already normalized by browser
    const s = Math.sin(walkClock);
    const legSwing = 0.5, armSwing = 0.35;

    if (B.legUL) B.legUL.rotation.x = rest.legUL.x + s * legSwing;
    if (B.legUR) B.legUR.rotation.x = rest.legUR.x - s * legSwing;
    if (B.legLL) B.legLL.rotation.x = rest.legLL.x + Math.max(0, -s) * 0.6;
    if (B.legLR) B.legLR.rotation.x = rest.legLR.x + Math.max(0, s) * 0.6;
    if (B.armUL) B.armUL.rotation.x = rest.armUL.x - s * armSwing;
    if (B.armUR) B.armUR.rotation.x = rest.armUR.x + s * armSwing;

    const bobAmount = 0.035;
    modelHolder.position.y = Math.abs(s) * bobAmount;
  }
  function swingPose(dt,tgt,soundType,world,onHit) {
    chopActive=true;
    const prev=chopPhase;
    chopPhase+=dt/swingInterval;
    const p=chopPhase;
    let armA;
    if (p<0.55) armA=(p/0.55)*-1.8; else armA=-1.8+((p-0.55)/0.45)*2.3;
    if (B.armUR) B.armUR.rotation.x=rest.armUR.x+armA;
    if (B.spine) B.spine.rotation.x=rest.spine.x+Math.min(0,armA+0.8)*0.2;
    if (p<0.55) { const t=p/0.55; axeRot.x=0.5-2.1*t; axeRot.z=0.2+0.6*t; }
    else { const t=(p-0.55)/0.45; axeRot.x=-1.6+2.1*t; axeRot.z=0.8-1.4*t; }
    if (prev<0.55&&chopPhase>=0.55) {
      tgt.takeDamage(1);
      const cam=world.camera;
      const lp=cam?{x:cam.position.x,z:cam.position.z}:{x:0,z:0};
      playSound(soundType,lp,group.position);
      onHit();
    }
    if (chopPhase>=1) chopPhase=0;
  }

  function findNearest(world,type) {
    const me=group.position;
    let best=null,bestDist=Infinity;
    const list=type==='chop'?(world.trees||[]):type==='stone'?(world.stones||[]):type==='gold'?(world.golds||[]):[];
    list.forEach((r)=>{
      if (r.isDepleted()) return;
      const p=r.position();
      const d=Math.sqrt((p.x-me.x)**2+(p.z-me.z)**2);
      if (d<bestDist){bestDist=d;best=r;}
    });
    return best;
  }

  function findNearestAnimal(world,maxDist) {
    const me=group.position;
    let best=null,bestDist=maxDist||999;
    (world.animals||[]).forEach((a)=>{
      if (a.isDepleted&&a.isDepleted()) return;
      const st=a.state?a.state():'wandering';
      if (st==='respawning') return;
      const p=a.position();
      const d=Math.sqrt((p.x-me.x)**2+(p.z-me.z)**2);
      if (d<bestDist){bestDist=d;best=a;}
    });
    return best;
  }

  function findNearestBuilding(world, type = null) {
    const me = group.position;
    let best = null, bestDist = Infinity;
    (world.buildings||[]).forEach((b) => {
      if (!b.storage || b.constructing) return;
      if (type && b.type !== type) return;
      const p = resolvePos(b);
      if (!p) return;
      const d = Math.sqrt((p.x - me.x) ** 2 + (p.z - me.z) ** 2);
      if (d < bestDist) { bestDist = d; best = b; }
    });
    return best;
  }

  function findDepositTarget(world) {
    const me = group.position;
    let house = null, townCenter = null;
    (world.buildings || []).forEach((b) => {
      if (!b.storage || b.constructing) return;
      const p = resolvePos(b);
      if (!p) return;
      const d = Math.sqrt((p.x - me.x) ** 2 + (p.z - me.z) ** 2);
      if (b.type === 'house' && !house) house = b;
      if (b.type === 'townCenter' && !townCenter) townCenter = b;
    });
    if (house) return house;
    return townCenter;
  }

  function depositInventory(building, world) {
    // Town Center charges a 50% tax; your own house stores everything tax-free.
    const isTownCenter = building.type === 'townCenter' || building.isTownCenter;
    const taxRate = isTownCenter ? 0.5 : 0;
    const depositorId = world.playerId || 'me';
    // Per-depositor ledger so the building knows who put in what.
    if (!building.ledger) building.ledger = {};
    if (!building.ledger[depositorId]) building.ledger[depositorId] = {wood:0,stone:0,gold:0,food:0,water:0};

    const carried = {};   // full amount taken off the unit
    let anything = false;
    Object.keys(inventory).forEach((key) => {
      const have = inventory[key];
      if (have > 0) {
        const kept = Math.floor(have * (1 - taxRate)); // after tax
        building.storage[key] = (building.storage[key] || 0) + kept;
        building.ledger[depositorId][key] += kept;
        carried[key] = have;
        inventory[key] = 0; // unit drops its entire load
        anything = true;
      }
    });
    if (anything) {
      world.socket.emit('depositBuilding', {
        buildingId: building.id,
        buildingType: building.type,
        resources: carried,
        taxRate
      });
    }
    updateWorldResources(world);
  }

  // The player's spendable total (world.resources) is now the SERVER-authoritative
  // stockpile, updated via the socket 'resourceUpdate' event when a worker deposits.
  // We intentionally no longer recompute it from local building storage + carried
  // loads — that local recompute was overwriting the real stockpile with a tiny
  // number, which is why deposited wood appeared to vanish.
  function updateWorldResources() { /* server-authoritative: no-op */ }

  function getNextHuntTarget(world) {
    if (lastKillPos) {
      const animals = (world.animals||[]).filter((a)=>{
        const st=a.state?a.state():'';
        return st==='meatpile'&&a.foodRemaining&&a.foodRemaining()>0;
      });
      let nearest=null,nd=Infinity;
      animals.forEach((a)=>{
        const p=a.position();
        const d=Math.sqrt((p.x-lastKillPos.x)**2+(p.z-lastKillPos.z)**2);
        if (d<8&&d<nd){nd=d;nearest=a;}
      });
      if (nearest) { lastKillPos=null; return nearest; }
      lastKillPos=null;
    }
    const a=findNearestAnimal(world,huntSearchRadius);
    if (a) { huntSearchRadius=20; return a; }
    huntSearchRadius=Math.min(huntSearchRadius+10,150);
    return null;
  }

  function update(dt,world) {
    // SERVER-DRIVEN MODE: the server simulates this worker (gather/deposit). The
    // client just smoothly follows the server position and animates — no local AI.
    if (world.serverDriven && serverPos) {
      resetPose(); chopActive=false; frozen=false;
      const me=group.position;
      const dx=serverPos.x-me.x, dz=serverPos.z-me.z;
      const d=Math.sqrt(dx*dx+dz*dz);
      if (d>0.06) {
        const step=Math.min(d, speed*dt*1.6);
        me.x+=dx/d*step; me.z+=dz/d*step;
        faceToward(serverPos.x, serverPos.z);
        walkPose(dt); moving=true;
      } else { moving=false; modelHolder.position.y*=0.7; }
      axeRot.x+=(axeRestRot.x-axeRot.x)*0.3; axeRot.y+=(axeRestRot.y-axeRot.y)*0.3; axeRot.z+=(axeRestRot.z-axeRot.z)*0.3;
      if (handR) { handR.getWorldPosition(handWorld); axeHolder.parent.worldToLocal(axeHolder.position.copy(handWorld)); axeHolder.rotation.set(axeRot.x,axeRot.y,axeRot.z); }
      if (world.camera) healthBar.group.quaternion.copy(world.camera.quaternion);
      healthBar.update(unit.health/unit.maxHealth);
      return;
    }

    resetPose();
    moving=false; chopActive=false; frozen=false;

    // HP/Hunger/Thirst deduction: 100% per 24 hours = 0.0694% per minute
    const deductRate = 0.00694 * dt; // per second
    const nearHome = world.buildings && world.buildings[0];
    const homePos = resolvePos(nearHome);
    const distToHome = homePos ? Math.sqrt((group.position.x - homePos.x)**2 + (group.position.z - homePos.z)**2) : Infinity;
    const inHouse = distToHome < 15; // Safe zone around town center

    if (inHouse) {
      // In house: restore at 1% per minute (0.01667% per second)
      const restoreRate = 0.01667 * dt;
      if (hunger < 100) hunger = Math.min(100, hunger + restoreRate);
      if (thirst < 100) thirst = Math.min(100, thirst + restoreRate);
      if (hp < 100) hp = Math.min(100, hp + restoreRate);
    } else {
      // Outside: deduct normally
      hunger = Math.max(0, hunger - deductRate);
      thirst = Math.max(0, thirst - deductRate);
    }

    // Auto-home at 5% of any stat
    if (!inHouse && (hunger <= 5 || thirst <= 5 || hp <= 5)) {
      if (!returning) {
        returning = true;
        target = homePos || group.position;
        depositTarget = nearHome;
        chopTarget = null;
        animalTarget = null;
        stoneTarget = null;
        goldTarget = null;
        autoTask = null;
      }
    }

    // Die if any stat hits 0
    if (hunger <= 0 || thirst <= 0 || hp <= 0) {
      group.visible = false;
      unit.alive = false;
      return;
    }

    waterDrainTimer+=dt;
    if (waterDrainTimer>=S.drain.waterInterval) { waterDrainTimer=0; if (world.resources.water>0) world.resources.water=Math.max(0,world.resources.water-1); }
    foodDrainTimer+=dt;
    if (foodDrainTimer>=S.drain.foodInterval) { foodDrainTimer=0; if (world.resources.food>0) world.resources.food=Math.max(0,world.resources.food-1); }

    if (world.pondPosition) {
      const dPond=distTo(world.pondPosition.x,world.pondPosition.z);
      if (dPond<=9.0&&world.resources.water<100) {
        waterRefillTimer+=dt;
        if (waterRefillTimer>=S.water.refillInterval) { waterRefillTimer=0; world.resources.water=Math.min(100,world.resources.water+1); }
      } else waterRefillTimer=0;
    }

    // Spiral resource search when home area depleted
    if ((chopTarget&&chopTarget.isDepleted())||(!chopTarget&&autoTask==='chop'&&inHouse)) {
      const spiralRadius = huntSearchRadius;
      const spiralMax = 8;
      let found = false;
      for (let i = 1; i <= spiralMax; i++) {
        const angle = huntAngle + (i * 0.5);
        const testPos = {x: spawnPos.x + Math.cos(angle) * (5 + i * 5), z: spawnPos.z + Math.sin(angle) * (5 + i * 5)};
        const nearest = findNearest(world,'chop');
        if (nearest) {
          chopTarget = nearest;
          found = true;
          break;
        }
      }
      if (!found && !target) {
        huntAngle += 0.5;
        target = new THREE.Vector3(spawnPos.x + Math.cos(huntAngle) * (5 + Math.random() * 20), 0, spawnPos.z + Math.sin(huntAngle) * (5 + Math.random() * 20));
      }
    }

    // Rescue system: if owner is under attack, go help
    if (world.players) {
      const myOwner = Object.values(world.players).find(p => p.units && p.units.some(u => u === unit));
      if (myOwner && myOwner.underAttack) {
        target = new THREE.Vector3(myOwner.position.x, 0, myOwner.position.z);
        returning = false;
        chopTarget = null;
        autoTask = null;
      }
    }

    if (returning&&depositTarget) {
      const dp=resolvePos(depositTarget);
      if (dp) {
        if (!isFull()&&autoTask==='hunt') {
          const nearMeat=(world.animals||[]).find((a)=>{
            const st=a.state?a.state():'';
            if (st!=='meatpile'||!a.foodRemaining||a.foodRemaining()<=0) return false;
            const p=a.position();
            return Math.sqrt((p.x-group.position.x)**2+(p.z-group.position.z)**2)<gatherRange*2;
          });
          if (nearMeat) { animalTarget=nearMeat; returning=false; depositTarget=null; }
        }
        const buildingWall=(depositTarget.radius||3)*0.75;
        const depositStop=buildingWall+radius+0.3; // Stop beyond collision boundary + safety buffer
        const arrived=moveToward({x:dp.x,z:dp.z},dt,depositStop);
        moving=!arrived;
        if (arrived) {
          depositInventory(depositTarget,world);
          returning=false; depositTarget=null;
          if (autoTask==='hunt') {
            const next=getNextHuntTarget(world);
            if (next) animalTarget=next;
            else { huntAngle+=0.5; const r=huntSearchRadius; target=new THREE.Vector3(spawnPos.x+Math.cos(huntAngle)*r,0,spawnPos.z+Math.sin(huntAngle)*r); }
          } else if (autoTask==='chop') {
            const next=findNearest(world,'chop');
            if (next){chopTarget=next;chopSlot=null;chopPhase=0;woodHitCount=0;}
          } else if (autoTask==='stone') {
            const next=findNearest(world,'stone');
            if (next){stoneTarget=next;stoneSlot=null;chopPhase=0;stoneHitCount=0;}
          } else if (autoTask==='gold') {
            const next=findNearest(world,'gold');
            if (next){goldTarget=next;goldSlot=null;chopPhase=0;goldHitCount=0;}
          }
        }
      } else { returning=false; depositTarget=null; }
      if (moving) walkPose(dt); else modelHolder.position.y*=0.7;
      if (!chopActive) { axeRot.x+=(axeRestRot.x-axeRot.x)*0.3; axeRot.y+=(axeRestRot.y-axeRot.y)*0.3; axeRot.z+=(axeRestRot.z-axeRot.z)*0.3; }
      separate(world);
      if (handR) { handR.getWorldPosition(handWorld); axeHolder.parent.worldToLocal(axeHolder.position.copy(handWorld)); axeHolder.rotation.set(axeRot.x,axeRot.y,axeRot.z); }
      if (world.camera) healthBar.group.quaternion.copy(world.camera.quaternion);
      healthBar.update(unit.health/unit.maxHealth);
      return;
    }

    if (isFull() && autoTask && !returning) {
      const building = findDepositTarget(world);
      if (building) {
        separate(world);
        depositTarget = building; returning = true; return;
      }
    }

    if (animalTarget) {
      if (animalTarget.isDepleted()) { animalTarget=null; }
      else {
        const ap=animalTarget.position(); const st=animalTarget.state();
        if (st==='meatpile') {
          if (animalTarget.foodRemaining()>0&&!isFull()) {
            if (distTo(ap.x,ap.z)<=gatherRange) {
              frozen=true; faceToward(ap.x,ap.z); gatherTimer+=dt;
              if (gatherTimer>=S.chicken.pickupInterval) {
                gatherTimer=0;
                const got=animalTarget.takeFood(1);
                inventory.food+=got;
                updateWorldResources(world);
              }
            } else { moveToward(ap,dt,0.5); moving=true; }
          } else {
            animalTarget=null;
            if (autoTask==='hunt') {
              const next=getNextHuntTarget(world);
              if (next) animalTarget=next;
              else { huntAngle+=0.5; const r=huntSearchRadius; target=new THREE.Vector3(spawnPos.x+Math.cos(huntAngle)*r,0,spawnPos.z+Math.sin(huntAngle)*r); }
            }
          }
        } else if (st==='wandering') {
          const d=distTo(ap.x,ap.z);
          if (d<=chopRange) {
            frozen=true; moving=false; faceToward(ap.x,ap.z);
            swingPose(dt,animalTarget,'chop',world,()=>{});
          } else {
            moveToward(ap,dt,chopRange*0.8);
            moving=true;
          }
        } else if (st==='dying') {
          frozen=true; faceToward(ap.x,ap.z);
        } else if (st==='respawning') {
          animalTarget=null;
        }
        if (animalTarget&&animalTarget.state()!=='wandering'&&animalTarget.state()!=='dying') {
          if (!lastKillPos) lastKillPos=animalTarget.position();
        }
      }
      if (!animalTarget&&autoTask==='hunt') {
        const next=getNextHuntTarget(world);
        if (next) animalTarget=next;
        else { huntAngle+=0.5; const r=huntSearchRadius; target=new THREE.Vector3(spawnPos.x+Math.cos(huntAngle)*r,0,spawnPos.z+Math.sin(huntAngle)*r); }
      }
    }
    else if (chopTarget) {
      if (chopTarget.isDepleted()) {
        const next=findNearest(world,'chop');
        if (next){chopTarget=next;chopSlot=null;chopPhase=0;woodHitCount=0;}
        else{chopTarget=null;chopSlot=null;}
      } else {
        const tp=chopTarget.position(); const st=chopTarget.state(); const dTree=distTo(tp.x,tp.z);
        if (st==='woodpile') {
          if (chopTarget.woodRemaining()>0&&!isFull()) {
            if (dTree<=gatherRange) {
              frozen=true; faceToward(tp.x,tp.z); gatherTimer+=dt;
              if (gatherTimer>=S.tree.pickupInterval) {
                gatherTimer=0; const got=chopTarget.takeWood(1); inventory.wood+=got; updateWorldResources(world);
              }
            } else { moveToward(chopSlot||tp,dt,0.15); moving=true; }
          } else {
            const next=findNearest(world,'chop');
            if (next&&!isFull()){chopTarget=next;chopSlot=null;chopPhase=0;woodHitCount=0;}
            else chopTarget=null;
          }
        } else {
          if (dTree<=chopRange) {
            frozen=true; moving=false; faceToward(tp.x,tp.z);
            if (st==='standing') {
              swingPose(dt,chopTarget,'chop',world,()=>{
                woodHitCount++;
                if (woodHitCount>=S.tree.hitsPerResource){woodHitCount=0;inventory.wood+=1;updateWorldResources(world);}
              });
            }
          } else { moveToward(chopSlot||tp,dt,0.15); moving=true; }
        }
      }
    }
    else if (stoneTarget) {
      if (stoneTarget.isDepleted()) {
        const next=findNearest(world,'stone');
        if (next){stoneTarget=next;stoneSlot=null;chopPhase=0;stoneHitCount=0;}
        else{stoneTarget=null;stoneSlot=null;}
      } else {
        const sp=stoneTarget.position(); const st=stoneTarget.state(); const dStone=distTo(sp.x,sp.z);
        if (st==='pile') {
          if (stoneTarget.stoneRemaining()>0&&!isFull()) {
            if (dStone<=gatherRange) {
              frozen=true; faceToward(sp.x,sp.z); gatherTimer+=dt;
              if (gatherTimer>=S.stone.pickupInterval){gatherTimer=0;const got=stoneTarget.takeStone(1);inventory.stone+=got;updateWorldResources(world);}
            } else { moveToward(stoneSlot||sp,dt,0.15); moving=true; }
          } else {
            const next=findNearest(world,'stone');
            if (next&&!isFull()){stoneTarget=next;stoneSlot=null;chopPhase=0;stoneHitCount=0;}
            else stoneTarget=null;
          }
        } else {
          if (dStone<=chopRange) {
            frozen=true; moving=false; faceToward(sp.x,sp.z);
            if (st==='standing') {
              swingPose(dt,stoneTarget,'mine',world,()=>{
                stoneHitCount++;
                if (stoneHitCount>=S.stone.hitsPerResource){stoneHitCount=0;inventory.stone+=1;updateWorldResources(world);}
              });
            }
          } else { moveToward(stoneSlot||sp,dt,0.15); moving=true; }
        }
      }
    }
    else if (goldTarget) {
      if (goldTarget.isDepleted()) {
        const next=findNearest(world,'gold');
        if (next){goldTarget=next;goldSlot=null;chopPhase=0;goldHitCount=0;}
        else{goldTarget=null;goldSlot=null;}
      } else {
        const gp=goldTarget.position(); const st=goldTarget.state(); const dGold=distTo(gp.x,gp.z);
        if (st==='pile') {
          if (goldTarget.goldRemaining()>0&&!isFull()) {
            if (dGold<=gatherRange) {
              frozen=true; faceToward(gp.x,gp.z); gatherTimer+=dt;
              if (gatherTimer>=S.gold.pickupInterval){gatherTimer=0;const got=goldTarget.takeGold(1);inventory.gold+=got;updateWorldResources(world);}
            } else { moveToward(goldSlot||gp,dt,0.15); moving=true; }
          } else {
            const next=findNearest(world,'gold');
            if (next&&!isFull()){goldTarget=next;goldSlot=null;chopPhase=0;goldHitCount=0;}
            else goldTarget=null;
          }
        } else {
          if (dGold<=chopRange) {
            frozen=true; moving=false; faceToward(gp.x,gp.z);
            if (st==='standing') {
              swingPose(dt,goldTarget,'mine',world,()=>{
                goldHitCount++;
                if (goldHitCount>=S.gold.hitsPerResource){goldHitCount=0;inventory.gold+=1;updateWorldResources(world);}
              });
            }
          } else { moveToward(goldSlot||gp,dt,0.15); moving=true; }
        }
      }
    }
    else if (target) {
      const arrived=moveToward(target,dt,0.5);
      if (arrived) {
        target=null;
        if (autoTask==='hunt') {
          const next=getNextHuntTarget(world);
          if (next) animalTarget=next;
          else { huntAngle+=0.8; const r=huntSearchRadius; target=new THREE.Vector3(spawnPos.x+Math.cos(huntAngle)*r,0,spawnPos.z+Math.sin(huntAngle)*r); }
        }
      } else moving=true;
    }
    // AUTO-TASK: Continue searching if task is still active but target is null
    else if (autoTask==='chop'&&!chopTarget) {
      const next=findNearest(world,'chop');
      if (next) chopTarget=next;
    }
    else if (autoTask==='stone'&&!stoneTarget) {
      const next=findNearest(world,'stone');
      if (next) stoneTarget=next;
    }
    else if (autoTask==='gold'&&!goldTarget) {
      const next=findNearest(world,'gold');
      if (next) goldTarget=next;
    }
    else if (autoTask==='hunt'&&!animalTarget) {
      const next=getNextHuntTarget(world);
      if (next) animalTarget=next;
    }

    if (moving) walkPose(dt); else modelHolder.position.y *= 0.7;

    // IMPROVEMENT #8 & #9: Optimized axe rotation and hand position sync
    if (!chopActive) {
      // Use smaller interpolation factor (0.2 instead of 0.3) for faster settling
      const lerpFactor = 0.2;
      axeRot.x += (axeRestRot.x - axeRot.x) * lerpFactor;
      axeRot.y += (axeRestRot.y - axeRot.y) * lerpFactor;
      axeRot.z += (axeRestRot.z - axeRot.z) * lerpFactor;
    }

    separate(world);

    // IMPROVEMENT #10: Only update axe position if hand exists and model is loaded
    // Cache the parent to reduce lookups
    if (handR && axeHolder.parent) {
      handR.getWorldPosition(handWorld);
      axeHolder.parent.worldToLocal(axeHolder.position.copy(handWorld));
      axeHolder.rotation.set(axeRot.x, axeRot.y, axeRot.z);
    }

    // Optimize health bar updates - only update when needed
    if (world.camera) {
      healthBar.group.quaternion.copy(world.camera.quaternion);
    }
    healthBar.update(unit.health / unit.maxHealth);
  }

  // IMPROVEMENT #11: Add proper cleanup function for memory leak prevention
  function dispose() {
    if (group.parent) group.parent.remove(group);
    if (healthBar && healthBar.group.parent) healthBar.group.parent.remove(healthBar.group);
    // Clean up Three.js resources
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  const unit = {
    group, type:'unit', team, radius, inventory,
    health:100, maxHealth:100, selected:false,
    hp, hunger, thirst,
    name: getUnitName(),
    stats: lifetimeGathered,
    aliveTime: getAliveTime,
    getModelCenterY:()=>modelCenterY,
    setSelected(b){unit.selected=b;healthBar.group.visible=b;},
    setServerPos(x,z){ if(!serverPos) serverPos={x,z}; else { serverPos.x=x; serverPos.z=z; } },
    moveTo(v){target=v.clone();chopTarget=null;animalTarget=null;stoneTarget=null;goldTarget=null;chopPhase=0;stoneHitCount=0;goldHitCount=0;woodHitCount=0;autoTask=null;returning=false;depositTarget=null;lastKillPos=null;},
    chopTree(tree,slot){chopTarget=tree;chopSlot=slot||null;animalTarget=null;stoneTarget=null;goldTarget=null;target=null;chopPhase=0;woodHitCount=0;autoTask='chop';returning=false;},
    killAnimal(animal){animalTarget=animal;chopTarget=null;stoneTarget=null;goldTarget=null;target=null;chopPhase=0;autoTask='hunt';returning=false;huntSearchRadius=20;},
    mineStone(stone,slot){stoneTarget=stone;stoneSlot=slot||null;chopTarget=null;animalTarget=null;goldTarget=null;target=null;chopPhase=0;stoneHitCount=0;autoTask='stone';returning=false;},
    mineGold(gold,slot){goldTarget=gold;goldSlot=slot||null;chopTarget=null;animalTarget=null;stoneTarget=null;target=null;chopPhase=0;goldHitCount=0;autoTask='gold';returning=false;},
    stop(){target=null;chopTarget=null;animalTarget=null;stoneTarget=null;goldTarget=null;autoTask=null;returning=false;depositTarget=null;lastKillPos=null;},
    // Player-commanded deposit: drop everything off at this building, then idle.
    depositAt(building){chopTarget=null;animalTarget=null;stoneTarget=null;goldTarget=null;target=null;autoTask=null;depositTarget=building;returning=true;lastKillPos=null;},
    update,
    dispose, // IMPROVEMENT #11: Expose dispose for cleanup
    animate(){}
  };

  return unit;
}