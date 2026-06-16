require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerUser, authenticateUser, getUserById, loadPlayerData, savePlayerData, createPasswordResetToken, resetPassword, verifyEmail, updateUserProfile, deleteUserAccount } = require('./auth');

const app = express();
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
        resources = { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };
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
      ownerId: socket.id
    };
    world.buildings.push(building);
    if (!player.buildings) player.buildings = [];
    player.buildings.push(building);
    io.emit('buildingPlaced', building);
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
  const { email, displayName, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const result = await registerUser(email, displayName, password);
    res.json({ success: true, userId: result.userId, email, message: 'Account created. Check console/email for verification token.', verificationToken: result.verificationToken });
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
    res.json({ success: true, userId, email, displayName: user?.displayName, message: 'Logged in' });
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AgeOfShadows] Server running on port ${PORT}`);
  console.log(`[AgeOfShadows] Socket.IO ready`);
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });