require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const net = require('net');
const { execSync } = require('child_process');

const WATCHDOG_PORT = parseInt(process.env.WATCHDOG_PORT || '5106');
const APP_PORT = parseInt(process.env.APP_PORT || '5006');
const GAME_FOLDER = process.cwd();

let gameProcess = null;
let gameRunning = false;

process.title = 'AgeOfShadows_manager';

// Check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port, '0.0.0.0');
  });
}

// Start game server
function startGameServer() {
  console.log(`[Manager] Starting game server on port ${APP_PORT}...`);
  gameProcess = spawn('node', ['server.js'], {
    cwd: GAME_FOLDER,
    stdio: 'inherit',
    env: { ...process.env }
  });

  gameProcess.on('exit', (code) => {
    console.log(`[Manager] Game server exited with code ${code}`);
    gameRunning = false;
    setTimeout(() => startGameServer(), 3000); // Auto-restart after 3 seconds
  });

  gameRunning = true;
}

// Restart game server
function restartGameServer() {
  console.log('[Manager] Restarting game server...');
  if (gameProcess) {
    gameProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!gameRunning) startGameServer();
    }, 1000);
  } else {
    startGameServer();
  }
}

// Git pull and restart
function updateAndRestart() {
  try {
    console.log('[Manager] Running git pull...');
    const output = execSync('git pull origin main', { cwd: GAME_FOLDER, encoding: 'utf-8' });
    console.log('[Manager] Git pull output:', output);
    restartGameServer();
    return { git_ok: true, git: output };
  } catch (error) {
    console.error('[Manager] Git pull failed:', error.message);
    return { git_ok: false, git: error.message };
  }
}

// Setup Express API for manager control
const app = express();
app.use(express.json());

// CORS headers on all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Status endpoint
app.get('/api/manager/status', (req, res) => {
  res.json({
    running: gameRunning,
    port: APP_PORT,
    timestamp: new Date().toISOString()
  });
});

// Restart endpoint
app.post('/api/manager/restart', (req, res) => {
  restartGameServer();
  res.json({ ok: true, message: 'Restarting game server...' });
});

// Update endpoint (git pull + restart)
app.post('/api/manager/update', (req, res) => {
  const result = updateAndRestart();
  res.json(result);
});

// Start manager server
(async () => {
  const available = await isPortAvailable(WATCHDOG_PORT);
  
  if (!available) {
    console.error(`[Manager] Port ${WATCHDOG_PORT} is already in use. Exiting.`);
    process.exit(1);
  }

  app.listen(WATCHDOG_PORT, '0.0.0.0', () => {
    console.log(`[Manager] Watchdog running on 0.0.0.0:${WATCHDOG_PORT}`);
    console.log(`[Manager] Control API: http://localhost:${WATCHDOG_PORT}/api/manager/status`);
    startGameServer();
  });
})();

process.on('SIGINT', () => {
  console.log('[Manager] SIGINT received, shutting down...');
  if (gameProcess) gameProcess.kill('SIGTERM');
  setTimeout(() => process.exit(0), 2000);
});