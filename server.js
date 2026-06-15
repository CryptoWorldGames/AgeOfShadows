require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initDatabase, registerUser, authenticateUser, loadPlayerData, savePlayerData, getUserByUsername } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Initialize database on startup
initDatabase();

const world = {
  trees: generateTrees(20),
  buildings: [],
  players: {}
};

// Track userId for each socket for saving data on disconnect
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

function createPlayerUnits(socketId) {
  const spawnX = (Math.random() - 0.5) * 20;
  const spawnZ = (Math.random() - 0.5) * 20;
  return [
    { id: `${socketId}_u0`, x: spawnX - 2, z: spawnZ, team: 'red', ownerId: socketId },
    { id: `${socketId}_u1`, x: spawnX + 2, z: spawnZ, team: 'blue', ownerId: socketId }
  ];
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
      // Load saved player data from database
      const savedData = await loadPlayerData(data.userId);

      let units, resources, buildings;
      if (savedData) {
        // Restore saved progress
        resources = savedData.resources;
        buildings = savedData.buildings;
        // Recreate units with saved positions
        units = savedData.units.length > 0
          ? savedData.units
          : createPlayerUnits(socket.id);
      } else {
        // New player: create fresh units
        units = createPlayerUnits(socket.id);
        resources = { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };
        buildings = [];
      }

      const user = await getUserByUsername(data.username);
      const player = {
        id: socket.id,
        userId: data.userId,
        name: user.username || `Player${Math.floor(Math.random() * 1000)}`,
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

  socket.on('disconnect', async () => {
    const player = world.players[socket.id];
    if (player) {
      const userId = socketUserMap[socket.id];
      if (userId) {
        try {
          // Save player data to database
          await savePlayerData(userId, player.resources, player.units, player.buildings || []);
          console.log(`${player.name} saved to database.`);
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
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const userId = await registerUser(username, password);
    res.json({ success: true, userId, message: 'Account created' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const userId = await authenticateUser(username, password);
    if (!userId) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ success: true, userId, username, message: 'Logged in' });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AgeOfShadows] Server running on port ${PORT}`);
  console.log(`[AgeOfShadows] Socket.IO ready`);
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });