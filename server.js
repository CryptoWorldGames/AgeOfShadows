require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

// Game state (in-memory for now)
const gameState = {
  players: {},
  units: [],
  buildings: [],
  resources: {}
};

// Player joins
app.post('/api/join', (req, res) => {
  const playerId = Date.now().toString();
  gameState.players[playerId] = {
    id: playerId,
    name: `Player${Math.floor(Math.random() * 1000)}`,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    resources: { gold: 500, wood: 300, food: 200 }
  };
  res.json({ playerId, player: gameState.players[playerId] });
});

// Get game state
app.get('/api/state/:playerId', (req, res) => {
  res.json(gameState);
});

// Player action (unit movement, building placement, etc.)
app.post('/api/action', (req, res) => {
  const { playerId, action, data } = req.body;
  console.log(`Player ${playerId}: ${action}`, data);
  res.json({ success: true, action, data });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.APP_PORT || '5006');
const server = http.createServer(app);

process.title = 'AgeOfShadows_server';

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AgeOfShadows] Game server running on 0.0.0.0:${PORT}`);
  console.log(`[AgeOfShadows] Health check: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('[AgeOfShadows] SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});