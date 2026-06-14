// ============================================================
// Age of Shadows — Game Settings
// Edit this file to tune all game balance values.
// ============================================================

export const SETTINGS = {

  // ===== RESOURCE NODES =====
  tree: {
    hitsToKill: 10,
    pickupInterval: 10,   // 1 wood per 10 sec
    yield: 10,
    respawnTime: 60
  },

  stone: {
    hitsToKill: 20,
    pickupInterval: 20,   // 1 stone per 20 sec
    yield: 8,
    respawnTime: 120
  },

  gold: {
    hitsToKill: 30,
    pickupInterval: 30,   // 1 gold per 30 sec
    yield: 5,
    respawnTime: 180
  },

  chicken: {
    hitsToKill: 3,
    pickupInterval: 10,   // 1 food per 10 sec
    yield: 5,
    respawnTime: 60
  },

  water: {
    refillInterval: 10,   // 1 water per 10 sec at pond
    bottleCapacity: 10,   // each water bottle holds 10 units
    maxWater: 100
  },

  // ===== RESOURCE DRAIN =====
  drain: {
    waterInterval: 300,   // 1 water lost per 5 min
    foodInterval: 300     // 1 food lost per 5 min
  },

  // ===== UNITS =====
  unit: {
    speed: 2.4,
    swingInterval: 0.7,
    chopRange: 1.8,
    gatherRange: 1.6
  },

  // ===== ANIMALS =====
  animal: {
    chicken: {
      wanderSpeed: 0.8,
      wanderRange: 15,
      respawnTime: 60
    },
    deer: {
      wanderSpeed: 3.5,   // deer are fast
      wanderRange: 40,
      canKill: false      // deer cannot be killed yet
    }
  },

  // ===== SPAWN COUNTS =====
  spawn: {
    trees: 20,
    chickens: 5,
    deer: 4,
    stoneDeposits: 8,
    goldDeposits: 4
  },

  // ===== BUILDINGS =====
  // woodCost, stoneCost, goldCost: resources to place
  // buildTime: seconds to build (future use)
  // tearDownTime: seconds to tear down with axe
  buildings: {
    townCenter: {
      label: 'Town Center',
      description: 'Main base. Spawn point for new units.',
      woodCost: 100,
      stoneCost: 0,
      goldCost: 0,
      buildTime: 30,       // 30 seconds to build
      tearDownTime: 60,    // 60 seconds to tear down
      unlocked: true       // available from start
    },
    house: {
      label: 'House',
      description: 'Increases max population by 5.',
      woodCost: 50,
      stoneCost: 20,
      goldCost: 0,
      buildTime: 20,
      tearDownTime: 30,
      unlocked: true
    },
    farm: {
      label: 'Farm',
      description: 'Produces 1 food every 30 seconds automatically.',
      woodCost: 40,
      stoneCost: 0,
      goldCost: 0,
      buildTime: 15,
      tearDownTime: 20,
      unlocked: true
    },
    lumberMill: {
      label: 'Lumber Mill',
      description: 'Workers gather wood 2x faster when nearby.',
      woodCost: 80,
      stoneCost: 10,
      goldCost: 0,
      buildTime: 25,
      tearDownTime: 40,
      unlocked: true
    },
    mine: {
      label: 'Mine',
      description: 'Required to gather gold and stone.',
      woodCost: 60,
      stoneCost: 30,
      goldCost: 0,
      buildTime: 40,
      tearDownTime: 60,
      unlocked: true
    },
    barracks: {
      label: 'Barracks',
      description: 'Train soldier units. Requires Town Center.',
      woodCost: 100,
      stoneCost: 50,
      goldCost: 20,
      buildTime: 60,
      tearDownTime: 90,
      unlocked: false      // requires town center first
    },
    wall: {
      label: 'Wall',
      description: 'Defensive structure. Blocks enemy movement.',
      woodCost: 20,
      stoneCost: 40,
      goldCost: 0,
      buildTime: 10,
      tearDownTime: 30,
      unlocked: false
    },
    tower: {
      label: 'Watch Tower',
      description: 'Increases vision range. Future: ranged attacks.',
      woodCost: 50,
      stoneCost: 60,
      goldCost: 10,
      buildTime: 45,
      tearDownTime: 60,
      unlocked: false
    },
    market: {
      label: 'Market',
      description: 'Trade resources. Buy/sell wood, stone, gold.',
      woodCost: 80,
      stoneCost: 40,
      goldCost: 30,
      buildTime: 50,
      tearDownTime: 70,
      unlocked: false
    },
    blacksmith: {
      label: 'Blacksmith',
      description: 'Upgrade axes and tools. Improves gather speed.',
      woodCost: 60,
      stoneCost: 80,
      goldCost: 50,
      buildTime: 60,
      tearDownTime: 80,
      unlocked: false
    }
  },

  // ===== WEAPONS (future) =====
  weapons: {
    axe: {
      label: 'Axe',
      damage: 1,
      attackInterval: 0.7,  // seconds per swing
      available: true
    }
    // sword, bow, spear coming later
  }
};