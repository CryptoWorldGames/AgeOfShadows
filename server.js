require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerUser, authenticateUser, getUserById, loadPlayerData, savePlayerData, createPasswordResetToken, resetPassword, verifyEmail, updateUserProfile, deleteUserAccount } = require('./auth');
const { isEmailConfigured } = require('./email');
const { initializeDatabase } = require('./database');
const worldsim = require('./worldsim');

const ADMIN_EMAILS = [
  'shadowdefense2023@gmail.com',
  'smartstuff2buy@gmail.com',
  process.env.ADMIN_EMAIL
].filter(Boolean); // Remove undefined/null
const isAdmin = (email) => ADMIN_EMAILS.includes(email);

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
  trees: worldsim.generateTrees(),   // ONE shared, server-owned forest for everyone
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

function createPlayerUnits(socketId, count = 1) {
  // Spawn OUT IN FRONT of the town center (which sits at the origin), not on top
  // of it. +z is "in front" where the starting camera looks.
  const spawnX = (Math.random() - 0.5) * 8;
  const spawnZ = 20 + Math.random() * 4;
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

// Authoritative tree clock: advance fall->woodpile and respawn transitions, and
// broadcast just the trees that changed so every client sees the same forest.
setInterval(() => {
  const changed = worldsim.tickTrees(world.trees);
  if (changed.length) io.emit('treesUpdate', changed);
}, 250);

// ===== AUTHORITATIVE WORKER SIMULATION =====
// Every player's units gather wood and deposit into their stockpile on the
// SERVER, whether the player is online, AFK, or logged out. This is what makes
// workers keep working offline and resources persist.
let lastSim = Date.now();
setInterval(() => {
  const now = Date.now();
  let dt = (now - lastSim) / 1000; lastSim = now;
  if (dt > 0.5) dt = 0.5;
  for (const sid in world.players) {
    const player = world.players[sid];
    if (!player.units) continue;
    const ref = { id: sid, name: player.name };
    for (const unit of player.units) {
      try { worldsim.stepUnit(unit, world.trees, player.resources, ref, dt, now); }
      catch (e) { /* never let one unit break the whole tick */ }
    }
    // push fresh stockpile to the owner if they're connected
    if (player.online !== false) io.to(sid).emit('resourceUpdate', player.resources);

    // Process build queue (Man units)
    if (player.buildQueue && player.buildQueue.length > 0) {
      player.buildQueue = player.buildQueue.filter((build) => {
        const elapsed = now - build.startedAt;
        if (elapsed >= build.duration) {
          if (build.kind === 'man') {
            if (!player.units) player.units = [];
            const newUnit = {
              id: `unit_${now}_${Math.random()}`,
              x: 0, z: 30,
              dx: 0, dz: 0,
              gathering: null,
              depositing: false,
              hp: 100, maxHp: 100,
              team: 'red'
            };
            player.units.push(newUnit);
            io.to(sid).emit('unitSpawned', { unit: newUnit });
          }
          return false;
        }
        return true;
      });
    }
  }
  // Drop players who've been offline for over an hour (after a final save).
  for (const sid in world.players) {
    const p = world.players[sid];
    if (p.online === false && p.offlineSince && now - p.offlineSince > 3600000) {
      delete world.players[sid]; delete socketUserMap[sid];
    }
  }
}, 250);

// Regular world snapshot (unit positions, players, buildings) for everyone.
setInterval(() => {
  io.emit('worldUpdate', {
    players: world.players,
    buildings: world.buildings
  });
}, 100);

// Periodic autosave: persist every connected player's stockpile/units so progress
// survives a crash or refresh without relying on a clean disconnect.
// (Silently skipped in demo mode if database is unavailable)
setInterval(() => {
  if (!process.env.DATABASE_URL) return; // Skip autosave in demo mode
  Object.keys(world.players).forEach((sid) => {
    const player = world.players[sid];
    const userId = socketUserMap[sid];
    if (!player || !userId) return;
    savePlayerData(userId, player.resources, player.units, player.buildings || [], player.buildQueue || [])
      .catch((err) => console.error(`[AUTOSAVE] ${player.name}:`, err.message));
  });
}, 30000);

// AUDIT FIX #4: Add online players list from database
function broadcastOnlinePlayers() {
  const onlinePlayers = Object.entries(world.players)
    .filter(([_, p]) => p.online !== false)
    .map(([sid, p]) => ({
      name: p.name,
      id: p.userId,
      team: p.team
    }));

  io.emit('onlinePlayers', onlinePlayers);
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', async (data) => {
    try {
      // Load saved player data (with fallback for demo mode)
      let savedData, user;
      try {
        savedData = await loadPlayerData(data.userId);
        user = await getUserById(data.userId);
      } catch (dbErr) {
        console.warn(`[DEMO MODE] Database unavailable for ${data.userId}, using demo defaults:`, dbErr.message);
        savedData = null;
        user = null;
      }

      // If this account already has a LIVE in-memory session (e.g. it kept working
      // while logged out), resume that exact state so no offline progress is lost.
      const liveSid = Object.keys(world.players).find(sid => world.players[sid].userId === data.userId);
      const live = liveSid ? world.players[liveSid] : null;

      let units, resources, buildings, buildQueue;
      if (live) {
        resources = live.resources;
        units = live.units;
        buildings = live.buildings || [];
        buildQueue = live.buildQueue || [];
      } else if (savedData) {
        resources = savedData.resources;
        buildings = savedData.buildings;
        units = savedData.units.length > 0 ? savedData.units : createPlayerUnits(socket.id, 1);
        buildQueue = savedData.build_queue || [];
      } else {
        units = createPlayerUnits(socket.id, 1);
        resources = { wood: 100, food: 50, water: 20, gold: 0, stone: 20 };
        buildings = [];
        buildQueue = [];
      }

      const player = {
        id: socket.id,
        userId: data.userId,
        name: user?.displayName || data.displayName || `Player${Math.floor(Math.random() * 1000)}`,
        color: data.color || `hsl(${Math.random() * 360}, 70%, 50%)`,
        resources,
        units,
        buildings,
        buildQueue,
        online: true
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

      // Re-add player's saved buildings to the world so they're visible to all players
      if (player.buildings && Array.isArray(player.buildings)) {
        player.buildings.forEach(b => {
          if (b && b.id && !world.buildings.find(wb => wb && wb.id === b.id)) {
            world.buildings.push(b);
          }
        });
      }

      // Send this player their own data + full world state
      socket.emit('joined', { playerId: socket.id, player, world });
      // Tell everyone else a new player joined with their units
      socket.broadcast.emit('playerJoined', { playerId: socket.id, player });
      // Broadcast updated online players list
      broadcastOnlinePlayers();
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

  // ----- Manual unit commands (your clicks). The server-sim obeys these. -----
  // Right-click ground: walk there, then resume auto-working from that spot.
  socket.on('commandMove', (data) => {
    const player = world.players[socket.id];
    if (!player || !data) return;
    const ids = data.unitId ? [data.unitId] : (data.unitIds || []);
    ids.forEach(id => {
      const u = player.units.find(x => x.id === id);
      if (u) { u.cmd = { type: 'move', x: data.x, z: data.z }; u.targetTreeId = null; u.phase = 'toResource'; }
    });
  });
  // Click a tree: send the unit(s) to chop that specific tree.
  socket.on('commandGather', (data) => {
    const player = world.players[socket.id];
    if (!player || !data) return;
    const ids = data.unitId ? [data.unitId] : (data.unitIds || []);
    ids.forEach(id => {
      const u = player.units.find(x => x.id === id);
      if (u) { u.cmd = null; u.targetTreeId = data.treeId; u.phase = 'toResource'; }
    });
  });
  // Click the town center with carrying units: dump their load now.
  socket.on('commandDeposit', (data) => {
    const player = world.players[socket.id];
    if (!player) return;
    const ids = (data && data.unitIds) || (player.units || []).map(u => u.id);
    ids.forEach(id => {
      const u = player.units.find(x => x.id === id);
      if (u) { u.cmd = null; u.phase = 'returning'; }
    });
  });

  // Right-click on an animal: hunt/attack it
  socket.on('commandHunt', (data) => {
    const player = world.players[socket.id];
    if (!player || !data) return;
    const ids = data.unitId ? [data.unitId] : (data.unitIds || []);
    ids.forEach(id => {
      const u = player.units.find(x => x.id === id);
      if (u) { u.cmd = null; u.autoTask = 'hunt'; u.huntTargetId = data.animalId; }
    });
  });

  // A swing at a tree. Server is authoritative: it decrements hp, assigns
  // ownership to the feller, and broadcasts so EVERY player sees it fall.
  socket.on('chopTree', (data) => {
    const tree = world.trees.find(t => t.id === data.treeId);
    const player = world.players[socket.id];
    if (!tree || !player) return;
    const changed = worldsim.chopTree(tree, player);
    if (changed) io.emit('treesUpdate', [tree]);
  });

  // Take one wood from a felled pile. Ownership is enforced: only the feller may
  // gather it for the first 5 minutes; after that anyone can grab it.
  socket.on('gatherWood', (data) => {
    const tree = world.trees.find(t => t.id === data.treeId);
    const player = world.players[socket.id];
    if (!tree || !player) return;
    const got = worldsim.gatherWood(tree, player);
    if (got > 0) {
      socket.emit('woodGathered', { treeId: tree.id, unitId: data.unitId, amount: got });
      io.emit('treesUpdate', [tree]);
    } else if (tree.state === 'woodpile') {
      // Denied — it isn't theirs yet. Tell them whose it is so the client can react.
      socket.emit('gatherDenied', { treeId: tree.id, ownerName: tree.ownerName });
    }
  });

  socket.on('buildStart', (data) => {
    const player = world.players[socket.id];
    if (!player || !data.kind) return;

    const buildDefs = { man: { foodCost: 10, buildTime: 60 } };
    const buildDef = buildDefs[data.kind];
    if (!buildDef) return;

    if ((buildDef.foodCost || 0) > (player.resources.food || 0)) return;
    player.resources.food -= buildDef.foodCost;

    if (!player.buildQueue) player.buildQueue = [];
    player.buildQueue.push({
      kind: data.kind,
      startedAt: Date.now(),
      duration: buildDef.buildTime * 1000
    });

    socket.emit('resourceUpdate', player.resources);
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

  // Worker drops its carried load at a building. The Town Center takes a 50%
  // tax; your own house is tax-free. The kept amount is banked into the player's
  // PERSISTENT stockpile (player.resources) — the single source of truth that
  // the Town Center panel shows and that gets saved to the database.
  socket.on('depositBuilding', (data) => {
    const player = world.players[socket.id];
    if (!player || !data || !data.resources) return;

    const isTownCenter = data.buildingType === 'townCenter';
    // Houses are private (owner only); the Town Center is public to all players.
    const building = world.buildings.find(b => b.id === data.buildingId);
    if (building && !isTownCenter && building.ownerId !== socket.id) return;

    const banked = worldsim.applyDeposit(player.resources, data.resources, isTownCenter);

    // The stockpile is authoritative — push it back so the HUD/Town Center match.
    socket.emit('resourceUpdate', player.resources);
    socket.emit('depositResult', { banked, isTownCenter, stockpile: player.resources });
    console.log(`[DEPOSIT] ${player.name} banked`, banked, isTownCenter ? '(Town Center -50%)' : '(house)');
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

  // NOTE: the client used to push its locally-computed resource total here every
  // 5s, which clobbered the authoritative stockpile (that's how deposited wood
  // "disappeared"). The server now owns player.resources, so this is ignored.
  socket.on('resourceSync', () => { /* server-authoritative: intentionally ignored */ });

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
      console.log(`${player.name} disconnected — workers keep running offline.`);
      // Do NOT delete the player: keep its units simulating on the server so they
      // keep gathering while the player is logged out. socketUserMap is kept so the
      // autosave loop still persists this player. It's cleaned up after 1h offline.
      player.online = false;
      player.offlineSince = Date.now();
      // Update online players list for all remaining clients
      broadcastOnlinePlayers();
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
// isAdmin() function already defined above with dual admin support

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

// ===== PROTECTED ADMIN DASHBOARD =====
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Age of Shadows - Admin Dashboard</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%);
          color: #c8a84b;
          min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 2px solid rgba(200,168,75,0.3);
          padding-bottom: 20px;
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { opacity: 0.7; font-size: 0.9em; }
        .login-form {
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(200,168,75,0.5);
          border-radius: 8px;
          padding: 30px;
          max-width: 400px;
          margin: 40px auto;
        }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: 600; }
        input {
          width: 100%;
          padding: 10px;
          background: rgba(0,0,0,0.8);
          border: 1px solid rgba(200,168,75,0.3);
          color: #c8a84b;
          border-radius: 4px;
        }
        button {
          width: 100%;
          padding: 12px;
          background: rgba(200,168,75,0.2);
          border: 1px solid #c8a84b;
          color: #c8a84b;
          cursor: pointer;
          border-radius: 4px;
          font-weight: 600;
          font-size: 1em;
          transition: all 0.3s;
        }
        button:hover { background: rgba(200,168,75,0.4); }
        .dashboard {
          display: none;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(200,168,75,0.5);
          border-radius: 8px;
          padding: 30px;
        }
        .dashboard.active { display: block; }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-box {
          background: rgba(200,168,75,0.1);
          border: 1px solid rgba(200,168,75,0.3);
          padding: 20px;
          border-radius: 6px;
        }
        .stat-label { opacity: 0.7; font-size: 0.9em; margin-bottom: 8px; }
        .stat-value { font-size: 2em; font-weight: 600; }
        .error { color: #ff6b6b; margin-top: 10px; }
        .success { color: #51cf66; margin-top: 10px; }
        .admin-user {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(200,168,75,0.15);
          padding: 10px 15px;
          border-radius: 4px;
          border: 1px solid rgba(200,168,75,0.3);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="admin-user" id="adminUser" style="display:none;">
          Logged in as: <strong id="adminEmail"></strong>
          <button onclick="logout()" style="margin-left: 10px; padding: 5px 10px; font-size: 0.9em;">Logout</button>
        </div>

        <header>
          <h1>🔐 Age of Shadows - Admin Dashboard</h1>
          <p class="subtitle">Game Management & Statistics</p>
        </header>

        <div class="login-form" id="loginForm">
          <h2 style="margin-bottom: 20px;">Admin Login</h2>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" placeholder="Admin Email">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="••••••••">
          </div>
          <button onclick="adminLogin()">Login to Admin Panel</button>
          <div id="loginError" class="error"></div>
        </div>

        <div class="dashboard" id="dashboard">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <h2>Dashboard</h2>
            <button onclick="refreshStats()" style="width: 150px;">🔄 Refresh</button>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-label">Players Online</div>
              <div class="stat-value" id="playerCount">-</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total Resources</div>
              <div class="stat-value" id="totalResources">-</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Trees on Map</div>
              <div class="stat-value" id="treeCount">-</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Buildings</div>
              <div class="stat-value" id="buildingCount">-</div>
            </div>
          </div>

          <div style="background: rgba(200,168,75,0.1); border: 1px solid rgba(200,168,75,0.3); padding: 20px; border-radius: 6px;">
            <h3 style="margin-bottom: 15px;">Online Players</h3>
            <div id="playersList" style="max-height: 400px; overflow-y: auto;">Loading...</div>
          </div>

          <div id="dashboardError" class="error"></div>
        </div>
      </div>

      <script>
        let adminToken = localStorage.getItem('adminToken');

        async function adminLogin() {
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          const errorDiv = document.getElementById('loginError');

          if (!email || !password) {
            errorDiv.textContent = 'Email and password required';
            return;
          }

          try {
            const response = await fetch('/api/admin/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (!response.ok) {
              errorDiv.textContent = data.error || 'Login failed';
              return;
            }

            adminToken = data.adminToken;
            localStorage.setItem('adminToken', adminToken);
            document.getElementById('adminEmail').textContent = email;
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('adminUser').style.display = 'block';
            document.getElementById('dashboard').classList.add('active');
            refreshStats();
          } catch (err) {
            errorDiv.textContent = 'Network error: ' + err.message;
          }
        }

        async function refreshStats() {
          if (!adminToken) return;
          try {
            const response = await fetch('/api/admin/stats', {
              headers: { 'x-admin-token': adminToken }
            });
            const data = await response.json();

            if (!response.ok) {
              document.getElementById('dashboardError').textContent = data.error || 'Failed to load stats';
              logout();
              return;
            }

            document.getElementById('playerCount').textContent = data.playerCount || 0;
            document.getElementById('totalResources').textContent = (data.totalResources || 0).toLocaleString();
            document.getElementById('treeCount').textContent = data.worldState.trees || 0;
            document.getElementById('buildingCount').textContent = data.worldState.buildings || 0;

            const playersList = document.getElementById('playersList');
            if (data.onlinePlayers && data.onlinePlayers.length > 0) {
              playersList.innerHTML = data.onlinePlayers.map(p => '<div style="padding: 10px; border-bottom: 1px solid rgba(200,168,75,0.2);"><strong>' + p.name + '</strong> - ' + (p.units || 0) + ' units<div style="opacity: 0.7; font-size: 0.9em; margin-top: 5px;">Wood: ' + (p.resources?.wood || 0) + ' | Stone: ' + (p.resources?.stone || 0) + ' | Gold: ' + (p.resources?.gold || 0) + '</div></div>').join('');
            } else {
              playersList.innerHTML = '<p style="opacity: 0.7;">No players online</p>';
            }
          } catch (err) {
            document.getElementById('dashboardError').textContent = 'Error: ' + err.message;
          }
        }

        function logout() {
          localStorage.removeItem('adminToken');
          adminToken = null;
          document.getElementById('loginForm').style.display = 'block';
          document.getElementById('adminUser').style.display = 'none';
          document.getElementById('dashboard').classList.remove('active');
          document.getElementById('email').value = '';
          document.getElementById('password').value = '';
          document.getElementById('loginError').textContent = '';
        }

        // Auto-load if token exists
        window.addEventListener('load', () => {
          if (adminToken) {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('adminUser').style.display = 'block';
            document.getElementById('dashboard').classList.add('active');
            refreshStats();
            setInterval(refreshStats, 10000); // Auto-refresh every 10 seconds
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const PORT = parseInt(process.env.PORT || '5006');
process.title = 'AgeOfShadows_server';

async function startServer() {
  try {
    if (process.env.DATABASE_URL) {
      console.log('[STARTUP] Initializing database...');
      await initializeDatabase();
      console.log('[STARTUP] Database: ✅ PostgreSQL connected');
    } else {
      console.warn('[STARTUP] ⚠️  DATABASE_URL not set! Running in DEMO MODE (no persistence)');
      console.warn('[STARTUP] To enable persistence, set DATABASE_URL in your environment:');
      console.warn('[STARTUP]   Example: postgres://user:pass@host:5432/ageofshadows');
      console.warn('[STARTUP] For Render: https://render.com → Dashboard → AgeOfShadows → Environment');
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[✅ AgeOfShadows] Server running on port ${PORT}`);
      console.log(`[✅ AgeOfShadows] Socket.IO ready`);
    });
  } catch (err) {
    console.error('[STARTUP] Failed to initialize database:', err.message);
    console.error('[STARTUP] Attempting to start server anyway in DEMO MODE...');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[✅ AgeOfShadows] Server running on port ${PORT} (demo mode)`);
      console.log(`[⚠️  AgeOfShadows] Database unavailable - player data will not persist`);
    });
  }
}

startServer();
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });