require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ===== Shared world state =====
const world = {
  trees: generateTrees(20),
  buildings: [],
  players: {}
};

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

// Tree respawn loop
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

// Broadcast world state every 100ms
setInterval(() => {
  io.emit('worldUpdate', {
    trees: world.trees,
    players: world.players,
    buildings: world.buildings
  });
}, 100);

// ===== Socket.IO =====
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', (data) => {
    const player = {
      id: socket.id,
      name: data.name || `Player${Math.floor(Math.random() * 1000)}`,
      color: data.color || `hsl(${Math.random() * 360}, 70%, 50%)`,
      resources: { wood: 0, food: 0, water: 0, gold: 0, stone: 0 },
      units: [
        { id: `${socket.id}_u0`, x: (Math.random()-0.5)*6, z: (Math.random()-0.5)*6, team: 'red' },
        { id: `${socket.id}_u1`, x: (Math.random()-0.5)*6, z: (Math.random()-0.5)*6, team: 'blue' }
      ]
    };
    world.players[socket.id] = player;
    socket.emit('joined', { playerId: socket.id, player, world });
    socket.broadcast.emit('playerJoined', { playerId: socket.id, player });
    console.log(`${player.name} joined. Players: ${Object.keys(world.players).length}`);
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
    const building = {
      id: `b_${Date.now()}`,
      type: data.type, x: data.x, z: data.z,
      ownerId: socket.id
    };
    world.buildings.push(building);
    io.emit('buildingPlaced', building);
  });

  socket.on('disconnect', () => {
    const player = world.players[socket.id];
    if (player) {
      console.log(`${player.name} disconnected.`);
      delete world.players[socket.id];
      io.emit('playerLeft', { playerId: socket.id });
    }
  });
});

// ===== REST =====
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

// Serve built client in production
app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const PORT = parseInt(process.env.APP_PORT || '5006');
process.title = 'AgeOfShadows_server';
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AgeOfShadows] Server running on port ${PORT}`);
  console.log(`[AgeOfShadows] Socket.IO ready`);
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });