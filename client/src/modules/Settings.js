export const SETTINGS = {
  tree: { hitsToKill: 10, hitsPerResource: 10, yield: 10, pickupInterval: 1.0, respawnTime: 900 },
  stone: { hitsToKill: 50, hitsPerResource: 20, yield: 10, pickupInterval: 1.0, respawnTime: 7200 },
  gold: { hitsToKill: 100, hitsPerResource: 40, yield: 10, pickupInterval: 1.0, respawnTime: 10800 },
  chicken: { hitsToKill: 3, pickupInterval: 1.0, yield: 10, respawnTime: 3600, minOnMap: 5 },
  deer: { hitsToKill: 100, pickupInterval: 1.0, yield: 20, respawnTime: 7200 },
  water: { refillInterval: 10, bottleCapacity: 10, maxWater: 100 },
  drain: { foodInterval: 2160, waterInterval: 2160 },
  unit: {
    speed: 2.4, swingInterval: 0.7, chopRange: 1.8, gatherRange: 2.5,
    carryMax: 100, huntRadius: 8
  },
  building: {
    townCenter: { woodCost: 100, stoneCost: 0, goldCost: 0, buildTime: 30, label: 'Town Center', storageMax: 100000 },
    house: { woodCost: 100, stoneCost: 0, goldCost: 0, buildTime: 180, label: 'House', maxUnits: 10, storageMax: 10000, decayInterval: 3600 },
    woodFence: { woodCost: 10, stoneCost: 0, goldCost: 0, buildTime: 10, hitsToDestroy: 25, label: 'Wood Fence' },
    stoneFence: { woodCost: 0, stoneCost: 50, goldCost: 0, buildTime: 20, hitsToDestroy: 100, label: 'Stone Fence' },
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
};