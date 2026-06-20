import os

base = r'C:\Users\mycry\games\AgeOfShadows'
src = base + r'\client\src\modules'

files = {}

# ============================================================
# Settings.js
# ============================================================
files[src + r'\Settings.js'] = r"""export const SETTINGS = {
  tree: { hitsToKill: 10, hitsPerResource: 10, yield: 10, pickupInterval: 1.0, respawnTime: 3600 },
  stone: { hitsToKill: 50, hitsPerResource: 20, yield: 10, pickupInterval: 1.0, respawnTime: 7200 },
  gold: { hitsToKill: 100, hitsPerResource: 40, yield: 10, pickupInterval: 1.0, respawnTime: 10800 },
  chicken: { hitsToKill: 3, pickupInterval: 1.0, yield: 10, respawnTime: 3600, minOnMap: 5 },
  deer: { hitsToKill: 15, pickupInterval: 1.0, yield: 20, respawnTime: 7200 },
  water: { refillInterval: 10, bottleCapacity: 10, maxWater: 100 },
  drain: { foodInterval: 2160, waterInterval: 2160 },
  unit: {
    speed: 2.4, swingInterval: 0.7, chopRange: 1.8, gatherRange: 2.5,
    carryMax: 100, huntRadius: 8
  },
  building: {
    townCenter: { woodCost: 100, stoneCost: 0, goldCost: 0, buildTime: 30, label: 'Town Center', storageMax: 100000 },
    house: { woodCost: 100, stoneCost: 0, goldCost: 0, buildTime: 60, label: 'House', maxUnits: 10, storageMax: 10000, decayInterval: 3600 },
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
function playSound(type, listenerPos, soundPos) {
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
  const healthBar = makeHealthBar(); healthBar.group.position.y=2.3; group.add(healthBar.group);

  let modelCenterY=1.0;
  const B={}; const rest={}; let handR=null;
  const handWorld = new THREE.Vector3();

  const loader = new GLTFLoader();
  loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    model.traverse((c) => {
      if (c.isMesh) {
        c.castShadow=true; c.receiveShadow=true;
        if (c.material && teamTint) {
          const mn = c.material.name||'';
          const isSkin = SKIN_MATS.some((s)=>mn.includes(s));
          if (!isSkin) { c.material=c.material.clone(); c.material.color.multiply(teamTint); }
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
  }, undefined, (err)=>console.error('Failed to load character:',err));

  // Inventory
  const inventory = {wood:0,stone:0,gold:0,food:0,water:0};
  const carryMax = SETTINGS.unit.carryMax;
  function carryTotal() { return Object.values(inventory).reduce((a,b)=>a+b,0); }
  function isFull() { return carryTotal()>=carryMax; }

  // Task state
  let target=null;
  let chopTarget=null; let chopSlot=null;
  let animalTarget=null; // current animal being hunted/gathered
  let stoneTarget=null; let stoneSlot=null;
  let goldTarget=null; let goldSlot=null;
  let autoTask=null; // 'chop'|'stone'|'gold'|'hunt'|null
  let depositTarget=null;
  let returning=false;
  let lastKillPos=null; // position of last kill to return and gather
  let huntSearchRadius=20; // expands as no animals found nearby
  let huntAngle=0; // for spiral search

  let moving=false; let walkClock=0; let chopPhase=0;
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
  function separate(world) {
    if (frozen) return;
    const me=group.position;
    world.units.forEach((o)=>{
      if (o===unit) return;
      let dx=me.x-o.group.position.x,dz=me.z-o.group.position.z;
      const dist=Math.sqrt(dx*dx+dz*dz);
      const minD=radius+o.radius;
      if (dist>1e-4&&dist<minD) { const push=(minD-dist)*0.5; me.x+=(dx/dist)*push; me.z+=(dz/dist)*push; }
    });
  }
  function walkPose(dt) {
    walkClock+=dt*7; const s=Math.sin(walkClock);
    if (B.legUL) B.legUL.rotation.x=rest.legUL.x+s*0.5;
    if (B.legUR) B.legUR.rotation.x=rest.legUR.x-s*0.5;
    if (B.legLL) B.legLL.rotation.x=rest.legLL.x+Math.max(0,-s)*0.6;
    if (B.legLR) B.legLR.rotation.x=rest.legLR.x+Math.max(0,s)*0.6;
    if (B.armUL) B.armUL.rotation.x=rest.armUL.x-s*0.35;
    if (B.armUR) B.armUR.rotation.x=rest.armUR.x+s*0.35;
    modelHolder.position.y=Math.abs(Math.sin(walkClock))*0.04;
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

  function findNearestBuilding(world) {
    const me=group.position;
    let best=null,bestDist=Infinity;
    (world.buildings||[]).forEach((b)=>{
      if (!b.storage) return;
      const p=b.getPosition?b.getPosition():b.position;
      if (!p) return;
      const d=Math.sqrt((p.x-me.x)**2+(p.z-me.z)**2);
      if (d<bestDist){bestDist=d;best=b;}
    });
    return best;
  }

  function depositInventory(building,world) {
    Object.keys(inventory).forEach((key)=>{
      if (inventory[key]>0) {
        const space=(building.storage.max||10000)-(building.storage[key]||0);
        const dep=Math.min(inventory[key],Math.max(0,space));
        building.storage[key]=(building.storage[key]||0)+dep;
        inventory[key]-=dep;
      }
    });
    updateWorldResources(world);
  }

  function updateWorldResources(world) {
    const totals={wood:0,stone:0,gold:0,food:0,water:0};
    (world.buildings||[]).forEach((b)=>{
      if (!b.storage) return;
      Object.keys(totals).forEach((k)=>{totals[k]+=(b.storage[k]||0);});
    });
    (world.units||[]).forEach((u)=>{
      if (!u.inventory) return;
      Object.keys(totals).forEach((k)=>{totals[k]+=(u.inventory[k]||0);});
    });
    Object.keys(totals).forEach((k)=>{world.resources[k]=totals[k];});
  }

  function getNextHuntTarget(world) {
    // First check if there is leftover meat at last kill spot
    if (lastKillPos) {
      const animals = (world.animals||[]).filter((a)=>{
        const st=a.state?a.state():'';
        return st==='meatpile'&&a.foodRemaining&&a.foodRemaining()>0;
      });
      // find meatpile near last kill pos
      let nearest=null,nd=Infinity;
      animals.forEach((a)=>{
        const p=a.position();
        const d=Math.sqrt((p.x-lastKillPos.x)**2+(p.z-lastKillPos.z)**2);
        if (d<8&&d<nd){nd=d;nearest=a;}
      });
      if (nearest) { lastKillPos=null; return nearest; }
      lastKillPos=null;
    }
    // Find nearest live or meatpile animal
    const a=findNearestAnimal(world,huntSearchRadius);
    if (a) { huntSearchRadius=20; return a; } // reset search radius on find
    // Expand search
    huntSearchRadius=Math.min(huntSearchRadius+10,150);
    return null;
  }

  function update(dt,world) {
    resetPose();
    moving=false; chopActive=false; frozen=false;

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

    // === DEPOSIT RUN ===
    if (returning&&depositTarget) {
      const dp=depositTarget.getPosition?depositTarget.getPosition():depositTarget.position;
      if (dp) {
        // On way back — if not full yet stop to pick up nearby meatpile
        if (!isFull()&&autoTask==='hunt') {
          const nearMeat=(world.animals||[]).find((a)=>{
            const st=a.state?a.state():'';
            if (st!=='meatpile'||!a.foodRemaining||a.foodRemaining()<=0) return false;
            const p=a.position();
            return Math.sqrt((p.x-group.position.x)**2+(p.z-group.position.z)**2)<gatherRange*2;
          });
          if (nearMeat) { animalTarget=nearMeat; returning=false; depositTarget=null; }
        }
        const arrived=moveToward({x:dp.x,z:dp.z},dt,2.0);
        moving=!arrived;
        if (arrived) {
          depositInventory(depositTarget,world);
          returning=false; depositTarget=null;
          // Resume auto-task
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

    // === CHECK FULL — deposit ===
    if (isFull()&&autoTask&&!returning) {
      const building=findNearestBuilding(world);
      if (building) { depositTarget=building; returning=true; return; }
    }

    // === HUNT ===
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
            // Done with this meatpile — find next animal
            animalTarget=null;
            if (autoTask==='hunt') {
              const next=getNextHuntTarget(world);
              if (next) animalTarget=next;
              else { huntAngle+=0.5; const r=huntSearchRadius; target=new THREE.Vector3(spawnPos.x+Math.cos(huntAngle)*r,0,spawnPos.z+Math.sin(huntAngle)*r); }
            }
          }
        } else if (st==='wandering') {
          // Chase animal continuously using its current position
          const d=distTo(ap.x,ap.z);
          if (d<=chopRange) {
            frozen=true; faceToward(ap.x,ap.z);
            swingPose(dt,animalTarget,'chop',world,()=>{});
          } else {
            // Always move toward animal's CURRENT position
            moveToward(ap,dt,chopRange*0.8);
            moving=true;
          }
        } else if (st==='dying') {
          frozen=true; faceToward(ap.x,ap.z);
        } else if (st==='meatpile'||st==='respawning') {
          animalTarget=null;
        }
        // Record kill position when animal just died
        if (animalTarget&&animalTarget.state()!=='wandering'&&animalTarget.state()!=='dying') {
          if (!lastKillPos) lastKillPos=animalTarget.position();
        }
      }
      // If animal target gone and still hunting, find next
      if (!animalTarget&&autoTask==='hunt') {
        const next=getNextHuntTarget(world);
        if (next) animalTarget=next;
        else { huntAngle+=0.5; const r=huntSearchRadius; target=new THREE.Vector3(spawnPos.x+Math.cos(huntAngle)*r,0,spawnPos.z+Math.sin(huntAngle)*r); }
      }
    }
    // === CHOP ===
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
            frozen=true; faceToward(tp.x,tp.z);
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
    // === STONE ===
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
            frozen=true; faceToward(sp.x,sp.z);
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
    // === GOLD ===
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
            frozen=true; faceToward(gp.x,gp.z);
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
        // Arrived at hunt search point — look for animals here
        if (autoTask==='hunt') {
          const next=getNextHuntTarget(world);
          if (next) animalTarget=next;
          else { huntAngle+=0.8; const r=huntSearchRadius; target=new THREE.Vector3(spawnPos.x+Math.cos(huntAngle)*r,0,spawnPos.z+Math.sin(huntAngle)*r); }
        }
      } else moving=true;
    }

    if (moving) walkPose(dt); else modelHolder.position.y*=0.7;
    if (!chopActive) { axeRot.x+=(axeRestRot.x-axeRot.x)*0.3; axeRot.y+=(axeRestRot.y-axeRot.y)*0.3; axeRot.z+=(axeRestRot.z-axeRot.z)*0.3; }
    separate(world);
    if (handR) { handR.getWorldPosition(handWorld); axeHolder.parent.worldToLocal(axeHolder.position.copy(handWorld)); axeHolder.rotation.set(axeRot.x,axeRot.y,axeRot.z); }
    if (world.camera) healthBar.group.quaternion.copy(world.camera.quaternion);
    healthBar.update(unit.health/unit.maxHealth);
  }

  const unit = {
    group, type:'unit', team, radius, inventory,
    health:100, maxHealth:100, selected:false,
    getModelCenterY:()=>modelCenterY,
    setSelected(b){unit.selected=b;},
    moveTo(v){target=v.clone();chopTarget=null;animalTarget=null;stoneTarget=null;goldTarget=null;chopPhase=0;stoneHitCount=0;goldHitCount=0;woodHitCount=0;autoTask=null;returning=false;depositTarget=null;lastKillPos=null;},
    chopTree(tree,slot){chopTarget=tree;chopSlot=slot||null;animalTarget=null;stoneTarget=null;goldTarget=null;target=null;chopPhase=0;woodHitCount=0;autoTask='chop';returning=false;},
    killAnimal(animal){animalTarget=animal;chopTarget=null;stoneTarget=null;goldTarget=null;target=null;chopPhase=0;autoTask='hunt';returning=false;huntSearchRadius=20;},
    mineStone(stone,slot){stoneTarget=stone;stoneSlot=slot||null;chopTarget=null;animalTarget=null;goldTarget=null;target=null;chopPhase=0;stoneHitCount=0;autoTask='stone';returning=false;},
    mineGold(gold,slot){goldTarget=gold;goldSlot=slot||null;chopTarget=null;animalTarget=null;stoneTarget=null;target=null;chopPhase=0;goldHitCount=0;autoTask='gold';returning=false;},
    stop(){target=null;chopTarget=null;animalTarget=null;stoneTarget=null;goldTarget=null;autoTask=null;returning=false;depositTarget=null;lastKillPos=null;},
    update, animate(){}
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

# GameScene
gamescene_content = (
    "import React, { useEffect, useRef } from 'react';\n"
    "import * as THREE from 'three';\n"
    "import { createEnvironment } from './modules/Environment';\n"
    "import { createHuman } from './modules/Human';\n"
    "import { createTree } from './modules/Tree';\n"
    "import { createUI } from './modules/UI';\n"
    "import { createControls } from './modules/Controls.jsx';\n"
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
    "    world.golds.push(createGold(scene, { x: 5, y:0, z: 5 }));\n"
    "    const startTC = createTownCenter(scene, false);\n"
    "    startTC.setPosition(0, 0); startTC.place();\n"
    "    startTC.storage = { wood:10000, stone:10000, gold:10000, food:10000, water:10000, max:100000 };\n"
    "    startTC.getPosition = () => ({ x:0, z:0 });\n"
    "    world.buildings.push(startTC);\n"
    "    world.animals.push(createChicken(scene, { x:6, y:0, z:6 }));\n"
    "    world.animals.push(createChicken(scene, { x:-6, y:0, z:6 }));\n"
    "    world.animals.push(createChicken(scene, { x:6, y:0, z:-6 }));\n"
    "    world.animals.push(createChicken(scene, { x:-6, y:0, z:-6 }));\n"
    "    world.animals.push(createChicken(scene, { x:0, y:0, z:8 }));\n"
    "    world.animals.push(createDeer(scene, { x:5, y:0, z:-8 }));\n"
    "    world.animals.push(createDeer(scene, { x:-5, y:0, z:-8 }));\n"
    "    world.animals.push(createDeer(scene, { x:10, y:0, z:5 }));\n"
    "    world.animals.push(createDeer(scene, { x:-10, y:0, z:5 }));\n"
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

with open(base + r'\client\src\GameScene.js', 'w', encoding='utf-8') as f:
    f.write(gamescene_content)
print('Wrote: GameScene.js')
print('\nAll done!')