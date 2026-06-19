require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerUser, authenticateUser, getUserById, loadPlayerData, savePlayerData, createPasswordResetToken, resetPassword, verifyEmail, updateUserProfile, deleteUserAccount } = require('./auth');
const { isEmailConfigured } = require('./email');
const { initializeDatabase } = require('./database');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

const app = express();

// Debug header to verify deployed version
app.use((req, res, next) => {
  res.setHeader('X-App-Version', 'v2.3-deployment-verify');
  res.removeHeader('Content-Security-Policy');
  res.setHeader('X-Content-Security-Policy', 'disabled');
  next();
});

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const world = {
  trees: generateTrees(20),
  buildings: [],
  players: {}
};

// Track userId for each socket to save on disconnect
const socketUserMap = {};

// Rate limiting: track registrations by IP
const registrationAttempts = {};

function checkRateLimit(ip) {
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  if (!registrationAttempts[ip]) {
    registrationAttempts[ip] = [];
  }
  // Clean old attempts
  registrationAttempts[ip] = registrationAttempts[ip].filter(t => now - t < dayInMs);
  if (registrationAttempts[ip].length >= 5) return false; // Max 5 per day per IP
  registrationAttempts[ip].push(now);
  return true;
}

function generateTrees(n) {
  const trees = [];
  const used = [];
  let attempts = 0;
  while (trees.length < n && attempts < 200) {
    attempts++;
    const x = (Math.random() - 0.5) * 120;
    const z = (Math.random() - 0.5) * 120;
    if (Math.sqrt(x*x + z*z) < 8) continue;
    let tooClose = false;
    for (const s of used) {
      if (Math.sqrt((x-s.x)**2 + (z-s.z)**2) < 5) { tooClose = true; break; }
    }
    if (tooClose) continue;
    used.push({ x, z });
    trees.push({
      id: `tree_${trees.length}`,
      x, z, hp: 10, maxHp: 10,
      wood: 10, state: 'standing', respawnTimer: 0
    });
  }
  return trees;
}

function createPlayerUnits(socketId, count = 1) {
  const spawnX = (Math.random() - 0.5) * 20;
  const spawnZ = (Math.random() - 0.5) * 20;
  const units = [];
  for (let i = 0; i < count; i++) {
    units.push({
      id: `${socketId}_u${i}`,
      x: spawnX + (i - Math.floor(count / 2)) * 3,
      z: spawnZ,
      team: i === 0 ? 'red' : 'blue',
      ownerId: socketId
    });
  }
  return units;
}

setInterval(() => {
  let changed = false;
  world.trees.forEach((t) => {
    if (t.state === 'respawning') {
      t.respawnTimer += 0.5;
      if (t.respawnTimer >= 60) {
        t.hp = 10; t.wood = 10;
        t.state = 'standing'; t.respawnTimer = 0;
        changed = true;
      }
    }
  });
  if (changed) io.emit('worldUpdate', { trees: world.trees });
}, 500);

// Unit AI simulation - men work, hunt, defend, and regenerate
setInterval(() => {
  Object.values(world.players).forEach((player) => {
    if (!player.units) return;
    player.units.forEach((unit) => {
      if (!unit.health) unit.health = 100;
      if (!unit.carrying) unit.carrying = { food: 0 };

      // Check if past 24-hour work limit
      const now = Date.now();
      const workStartTime = unit.workStartTime || now;
      const elapsedSeconds = (now - workStartTime) / 1000;
      const pastWorkLimit = elapsedSeconds >= 86400; // 24 hours

      // If currently working
      if (unit.isWorking && !pastWorkLimit) {
        // Simulate work: gather 1 food per tick, take 0.5 damage per tick (simulate combat/exertion)
        unit.carrying.food += 1;
        unit.health = Math.max(0, unit.health - 0.5);

        // Auto-deposit when full
        if (unit.carrying.food >= 100) {
          const house = world.buildings.find(b => b.ownerId === player.id && b.type === 'house');
          if (house) {
            house.storage = house.storage || {};
            house.storage.food = (house.storage.food || 0) + unit.carrying.food;
          } else {
            const tc = world.townCenterLedger = world.townCenterLedger || { ledger: {} };
            tc.ledger[player.id] = tc.ledger[player.id] || { name: player.name };
            const stored = Math.floor(unit.carrying.food * 0.5);
            tc.ledger[player.id].food = (tc.ledger[player.id].food || 0) + stored;
          }
          unit.carrying.food = 0;
        }

        // Critical health: retreat to house
        if (unit.health <= 5) {
          unit.isWorking = false;
          unit.isRegenerating = true;
          unit.regenStartTime = now;
          console.log(`[RETREAT] Unit retreated to house (${unit.health}% HP)`);
        }
      } else if (unit.isWorking && pastWorkLimit) {
        // Work time expired - stop working
        unit.isWorking = false;
        console.log(`[WORK-END] Unit work ended after 24 hours`);
      }

      // If idle (not working, not regenerating): lose 1 HP per hour (0.0028 per 5-sec tick)
      if (!unit.isWorking && !unit.isRegenerating) {
        unit.health = Math.max(0, unit.health - 0.0139); // 1 HP per hour ≈ 0.0139 per 5 seconds
      }

      // Regenerating in house: 1 hour to full health
      if (unit.isRegenerating) {
        const regenElapsed = (now - (unit.regenStartTime || now)) / 1000;
        if (regenElapsed >= 3600) { // 1 hour
          unit.health = 100;
          unit.isRegenerating = false;
          // Auto-resume work if still within 24 hours
          const newElapsed = (now - workStartTime) / 1000;
          if (newElapsed < 86400 && unit.taskType) {
            unit.isWorking = true;
            console.log(`[RESUME] Unit resumed ${unit.taskType} after regeneration`);
          } else {
            console.log(`[REGEN-DONE] Unit fully healed but work time expired`);
          }
        } else {
          // Heal 100 HP over 3600 seconds = 0.0278 per 5-sec tick
          unit.health = Math.min(100, unit.health + (100 / 3600) * 5);
        }
      }
    });
  });
}, 5000); // Every 5 seconds

setInterval(() => {
  io.emit('worldUpdate', {
    trees: world.trees,
    players: world.players,
    buildings: world.buildings
  });
}, 100);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', async (data) => {
    try {
      // Load saved player data
      const savedData = await loadPlayerData(data.userId);
      const user = await getUserById(data.userId);

      let units, resources, buildings;
      if (savedData) {
        resources = savedData.resources;
        buildings = savedData.buildings;
        units = savedData.units.length > 0 ? savedData.units : createPlayerUnits(socket.id, 1);
      } else {
        units = createPlayerUnits(socket.id, 1);
        resources = { wood: 100, food: 50, water: 20, gold: 0, stone: 20 };
        buildings = [];
      }

      const player = {
        id: socket.id,
        userId: data.userId,
        name: user?.displayName || `Player${Math.floor(Math.random() * 1000)}`,
        color: data.color || `hsl(${Math.random() * 360}, 70%, 50%)`,
        resources,
        units,
        buildings
      };

      // Remove any stale session for the SAME user (e.g. a reconnect under a new
      // socket id) so a single account never shows up as two avatars on the map.
      Object.keys(world.players).forEach((sid) => {
        if (sid !== socket.id && world.players[sid].userId === data.userId) {
          delete world.players[sid];
          delete socketUserMap[sid];
          io.emit('playerLeft', { playerId: sid });
        }
      });

      world.players[socket.id] = player;
      socketUserMap[socket.id] = data.userId;

      // Send this player their own data + full world state
      socket.emit('joined', { playerId: socket.id, player, world });
      // Tell everyone else a new player joined with their units
      socket.broadcast.emit('playerJoined', { playerId: socket.id, player });
      console.log(`${player.name} (userId: ${data.userId}) joined. Players: ${Object.keys(world.players).length}`);
    } catch (err) {
      console.error('Error on join:', err);
      socket.emit('joinError', { error: err.message });
    }
  });

  socket.on('unitMove', (data) => {
    const player = world.players[socket.id];
    if (!player) return;
    const unit = player.units.find(u => u.id === data.unitId);
    if (unit) { unit.x = data.x; unit.z = data.z; }
  });

  socket.on('chopTree', (data) => {
    const tree = world.trees.find(t => t.id === data.treeId);
    if (!tree || tree.state !== 'standing') return;
    tree.hp -= 1;
    if (tree.hp <= 0) {
      tree.hp = 0; tree.state = 'falling';
      setTimeout(() => { tree.state = 'woodpile'; io.emit('treeUpdate', tree); }, 2000);
    }
    io.emit('treeUpdate', tree);
  });

  socket.on('gatherWood', (data) => {
    const tree = world.trees.find(t => t.id === data.treeId);
    const player = world.players[socket.id];
    if (!tree || !player || tree.state !== 'woodpile' || tree.wood <= 0) return;
    const got = Math.min(1, tree.wood);
    tree.wood -= got;
    player.resources.wood += got;
    if (tree.wood <= 0) { tree.state = 'respawning'; tree.respawnTimer = 0; }
    socket.emit('resourceUpdate', player.resources);
    io.emit('treeUpdate', tree);
  });

  socket.on('placeBuilding', (data) => {
    const player = world.players[socket.id];
    if (!player) return;
    const building = {
      id: `b_${Date.now()}`,
      type: data.type, x: data.x, z: data.z,
      ownerId: socket.id,
      storage: { wood: 0, stone: 0, gold: 0, food: 0, water: 0 },
      storageMax: 10000
    };
    world.buildings.push(building);
    if (!player.buildings) player.buildings = [];
    player.buildings.push(building);
    io.emit('buildingPlaced', building);
  });

  socket.on('depositBuilding', (data) => {
    const player = world.players[socket.id];
    if (!player || !data || !data.resources) return;

    const isTownCenter = data.buildingType === 'townCenter';
    // Houses are private (owner only); the Town Center is public to all players.
    let building = world.buildings.find(b => b.id === data.buildingId);
    if (building && !isTownCenter && building.ownerId !== socket.id) return;

    const taxRate = isTownCenter ? 0.5 : 0;

    // Keep a per-player ledger on the building so it knows who deposited what.
    // (The Town Center may live only on clients, so we track its ledger here.)
    if (!building) building = (isTownCenter
      ? (world.townCenterLedger = world.townCenterLedger || { id: data.buildingId, ledger: {} })
      : null);
    if (!building) return;
    building.ledger = building.ledger || {};
    const led = building.ledger[socket.id] = building.ledger[socket.id] || { name: player.name };

    Object.keys(data.resources).forEach(key => {
      const amount = data.resources[key] || 0;
      const kept = Math.floor(amount * (1 - taxRate));
      if (building.storage) building.storage[key] = (building.storage[key] || 0) + kept;
      led[key] = (led[key] || 0) + kept;
    });
    // player.resources is kept authoritative by the 5s resourceSync, so we do
    // not mutate it here (avoids double-counting against the client total).

    console.log(`[DEPOSIT] ${player.name} -> ${isTownCenter ? 'Town Center' : 'house'} (tax ${taxRate * 100}%)`);
  });

  socket.on('chat', (data) => {
    if (!data.message || !data.playerName) return;
    const chatMessage = {
      playerName: data.playerName,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    io.emit('chatMessage', chatMessage);
    console.log(`[CHAT] ${data.playerName}: ${data.message}`);
  });

  socket.on('resourceSync', (data) => {
    const player = world.players[socket.id];
    if (player && data.resources) {
      player.resources = data.resources;
      console.log(`[SYNC] ${player.name} resources:`, data.resources);
    }
  });

  socket.on('buildUnit', (data) => {
    const player = world.players[socket.id];
    if (!player) return;

    const cost = 10; // food cost to build one man
    if (player.resources.food < cost) {
      socket.emit('toast', `Need ${cost} food to build a man (you have ${player.resources.food})`);
      return;
    }

    // Deduct cost
    player.resources.food -= cost;

    // Create new unit at player's first unit location (or center)
    const spawnX = player.units[0]?.x || 0;
    const spawnZ = player.units[0]?.z || 18;
    const newUnit = {
      id: `${socket.id}_u${player.units.length}_${Date.now()}`,
      x: spawnX,
      z: spawnZ,
      team: 'red',
      ownerId: socket.id,
      health: 100,
      carrying: { food: 0 },
      isWorking: false,
      isRegenerating: false,
      taskType: null,
      workStartTime: null,
      regenStartTime: null
    };
    player.units.push(newUnit);

    socket.emit('resourceUpdate', player.resources);
    socket.emit('toast', `Built a new man for ${cost} food!`);
    console.log(`[BUILD] ${player.name} built a new unit. Total: ${player.units.length}`);
  });

  socket.on('setUnitTask', (data) => {
    const player = world.players[socket.id];
    if (!player || !data.unitId || !data.task) return;

    const unit = player.units.find(u => u.id === data.unitId);
    if (!unit) return;

    unit.isWorking = true;
    unit.taskType = data.task; // 'hunt', 'wood', 'stone', 'gold', etc.
    unit.workStartTime = Date.now();
    unit.health = 100;
    unit.carrying = { food: 0 };
    unit.isRegenerating = false;

    socket.emit('toast', `Unit started ${data.task} (24 hour shift)`);
    console.log(`[TASK] Unit set to ${data.task} for 24 hours`);
  });

  socket.on('disconnect', async () => {
    const player = world.players[socket.id];
    if (player) {
      const userId = socketUserMap[socket.id];
      if (userId) {
        try {
          // Save player data
          await savePlayerData(userId, player.resources, player.units, player.buildings || []);
          console.log(`${player.name} saved to storage.`);
        } catch (err) {
          console.error(`Failed to save player data for ${player.name}:`, err);
        }
      }
      console.log(`${player.name} disconnected.`);
      delete world.players[socket.id];
      delete socketUserMap[socket.id];
      io.emit('playerLeft', { playerId: socket.id });
    }
  });
});

// Authentication endpoints
app.post('/api/register', async (req, res) => {
  let { email, displayName, password, wantsEmails } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  // Display name is optional (UI marks it optional) — default to the email prefix
  if (!displayName || !displayName.trim()) {
    displayName = email.split('@')[0];
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many registration attempts. Try again tomorrow.' });
  }

  try {
    const result = await registerUser(email, displayName, password, {
      wantsEmails: wantsEmails || false
    });
    res.json({
      success: true,
      userId: result.userId,
      email,
      displayName,
      emailConfigured: isEmailConfigured(),
      message: 'Account created! Welcome to Age of Shadows.'
    });
  } catch (err) {
    if (err.message.includes('already registered')) {
      res.status(400).json({ error: 'Email already registered' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const userId = await authenticateUser(email, password);
    if (!userId) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = await getUserById(userId);
    const response = { success: true, userId, email, displayName: user?.displayName, message: 'Logged in' };
    if (isAdmin(email)) {
      response.adminToken = Buffer.from(email).toString('base64');
    }
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  try {
    const token = await createPasswordResetToken(email);
    if (!token) {
      return res.json({ success: true, message: 'If email exists, reset token sent' });
    }
    console.log(`Password reset token for ${email}: ${token}`);
    res.json({ success: true, message: 'Password reset token sent', token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/api/verify-email', async (req, res) => {
  const { verificationToken } = req.body;
  if (!verificationToken) {
    return res.status(400).json({ error: 'Verification token required' });
  }
  try {
    const success = await verifyEmail(verificationToken);
    if (!success) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    res.json({ success: true, message: 'Email verified! You can now play.' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/profile', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }
  try {
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      profile: user.profile || { age: null, state: null, country: null }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.post('/api/profile', async (req, res) => {
  const { userId, age, state, country } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }
  try {
    const success = await updateUserProfile(userId, age, state, country);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

app.post('/api/delete-account', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }
  try {
    const success = await deleteUserAccount(userId);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  if (!email || !resetToken || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const success = await resetPassword(email, resetToken, newPassword);
    if (!success) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Game endpoints
app.post('/api/spawn-worker', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  try {
    const playerData = await loadPlayerData(userId);
    if (!playerData) return res.status(404).json({ error: 'Player not found' });

    const COST = { wood: 500, food: 1000, stone: 200, gold: 50 };
    const hasResources = Object.entries(COST).every(([res, cost]) => playerData.resources[res] >= cost);

    if (!hasResources) {
      return res.status(400).json({ error: `Need: ${COST.wood}🪵 ${COST.food}🍖 ${COST.stone}⛏️ ${COST.gold}💰` });
    }

    Object.entries(COST).forEach(([res, cost]) => {
      playerData.resources[res] -= cost;
    });

    const newWorker = {
      id: `${userId}_w${Date.now()}`,
      x: Math.random() * 30 - 15,
      z: Math.random() * 30 - 15,
      task: 'idle',
      ownerId: userId
    };
    playerData.units.push(newWorker);
    await savePlayerData(userId, playerData.resources, playerData.units, playerData.buildings);

    res.json({ success: true, worker: newWorker, resources: playerData.resources });
  } catch (err) {
    res.status(500).json({ error: 'Failed to spawn worker' });
  }
});

app.post('/api/wallet', async (req, res) => {
  const { userId, cashapp, paypal, solana } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  try {
    const users = require('./auth').loadUsers ? JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'data/users.json'), 'utf-8')) : {};
    if (users[userId]) {
      users[userId].wallet = { cashapp, paypal, solana };
      require('fs').writeFileSync(require('path').join(__dirname, 'data/users.json'), JSON.stringify(users, null, 2));
    }
    res.json({ success: true, message: 'Wallet saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save wallet' });
  }
});

app.post('/api/buy-currency', async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !amount) return res.status(400).json({ error: 'User ID and amount required' });

  const playerData = await loadPlayerData(userId);
  if (!playerData) return res.status(404).json({ error: 'Player not found' });

  playerData.resources.gold = (playerData.resources.gold || 0) + amount;
  await savePlayerData(userId, playerData.resources, playerData.units, playerData.buildings);

  res.json({ success: true, gold: playerData.resources.gold, message: `Added ${amount} gold` });
});

app.get('/api/market', (req, res) => {
  const listings = global.marketListings || [];
  res.json({ listings });
});

app.post('/api/market/list', async (req, res) => {
  const { userId, resource, amount, price } = req.body;
  if (!userId || !resource || !amount || !price) return res.status(400).json({ error: 'Missing fields' });

  const playerData = await loadPlayerData(userId);
  if (!playerData || playerData.resources[resource] < amount) {
    return res.status(400).json({ error: 'Insufficient resources' });
  }

  playerData.resources[resource] -= amount;
  await savePlayerData(userId, playerData.resources, playerData.units, playerData.buildings);

  const listing = {
    id: `${userId}_${Date.now()}`,
    userId,
    resource,
    amount,
    price,
    createdAt: new Date().toISOString()
  };

  global.marketListings = global.marketListings || [];
  global.marketListings.push(listing);

  res.json({ success: true, listing });
});

app.post('/api/market/buy', async (req, res) => {
  const { userId, listingId } = req.body;
  if (!userId || !listingId) return res.status(400).json({ error: 'User ID and listing ID required' });

  global.marketListings = global.marketListings || [];
  const listing = global.marketListings.find(l => l.id === listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const buyer = await loadPlayerData(userId);
  const seller = await loadPlayerData(listing.userId);

  if (buyer.resources.gold < listing.price) {
    return res.status(400).json({ error: 'Insufficient gold' });
  }

  buyer.resources.gold -= listing.price;
  buyer.resources[listing.resource] = (buyer.resources[listing.resource] || 0) + listing.amount;
  seller.resources.gold = (seller.resources.gold || 0) + listing.price;

  await savePlayerData(userId, buyer.resources, buyer.units, buyer.buildings);
  await savePlayerData(listing.userId, seller.resources, seller.units, seller.buildings);

  global.marketListings = global.marketListings.filter(l => l.id !== listingId);

  res.json({ success: true, message: 'Trade completed' });
});

// ADMIN PANEL - SECURE ACCESS ONLY
function isAdmin(userEmail) {
  return userEmail === ADMIN_EMAIL;
}

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (!isAdmin(email)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    const userId = await authenticateUser(email, password);
    if (!userId) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = await getUserById(userId);
    res.json({ success: true, userId, email, adminToken: Buffer.from(email).toString('base64') });
  } catch (err) {
    res.status(500).json({ error: 'Admin login failed' });
  }
});

app.get('/api/admin/stats', (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  const email = adminToken ? Buffer.from(adminToken, 'base64').toString() : '';

  if (!isAdmin(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const playerCount = Object.keys(world.players).length;
  const totalResources = Object.values(world.players).reduce((sum, p) => sum + Object.values(p.resources).reduce((a, b) => a + b, 0), 0);

  res.json({
    playerCount,
    totalResources,
    worldState: {
      trees: world.trees.length,
      players: playerCount,
      buildings: world.buildings.length
    },
    onlinePlayers: Object.values(world.players).map(p => ({ name: p.name, resources: p.resources, units: p.units.length }))
  });
});

app.post('/api/admin/wipe-player', (req, res) => {
  const { adminToken, targetUserId } = req.body;
  const email = adminToken ? Buffer.from(adminToken, 'base64').toString() : '';

  if (!isAdmin(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    deleteUserAccount(targetUserId);
    res.json({ success: true, message: `Player ${targetUserId} wiped` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to wipe player' });
  }
});

app.post('/api/admin/gift-resources', (req, res) => {
  const { adminToken, userId, resources } = req.body;
  const email = adminToken ? Buffer.from(adminToken, 'base64').toString() : '';

  if (!isAdmin(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const playerData = loadPlayerData(userId);
    if (!playerData) return res.status(404).json({ error: 'Player not found' });

    Object.entries(resources || {}).forEach(([res, amount]) => {
      playerData.resources[res] = (playerData.resources[res] || 0) + amount;
    });

    savePlayerData(userId, playerData.resources, playerData.units, playerData.buildings);
    res.json({ success: true, message: 'Resources gifted', resources: playerData.resources });
  } catch (err) {
    res.status(500).json({ error: 'Failed to gift resources' });
  }
});

app.post('/api/join', (req, res) => {
  res.json({ playerId: Date.now().toString() });
});
app.get('/api/state/:playerId', (req, res) => {
  res.json({ players: world.players, trees: world.trees });
});
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    players: Object.keys(world.players).length,
    timestamp: new Date().toISOString()
  });
});

app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const PORT = parseInt(process.env.PORT || '5006');
process.title = 'AgeOfShadows_server';

async function startServer() {
  try {
    console.log('[STARTUP] Initializing database...');
    await initializeDatabase();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[AgeOfShadows] Server running on port ${PORT}`);
      console.log(`[AgeOfShadows] Socket.IO ready`);
      console.log(`[STARTUP] Database: ${process.env.DATABASE_URL ? 'PostgreSQL (production)' : 'ERROR: DATABASE_URL not set!'}`);
    });
  } catch (err) {
    console.error('[STARTUP] Failed to initialize database:', err.message);
    process.exit(1);
  }
}

startServer();
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });