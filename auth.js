const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const PLAYERS_FILE = path.join(__dirname, 'data', 'players.json');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

function loadPlayers() {
  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      return JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading players:', err);
  }
  return {};
}

function savePlayers(players) {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2));
  } catch (err) {
    console.error('Error saving players:', err);
  }
}

function registerUser(email, displayName, password) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();

      // Check if email exists
      if (Object.values(users).some(u => u.email === email)) {
        return reject(new Error('Email already registered'));
      }

      const userId = Date.now().toString();
      const hash = bcrypt.hashSync(password, 10);
      const verificationToken = require('crypto').randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      users[userId] = {
        id: userId,
        email,
        displayName: displayName || email.split('@')[0],
        passwordHash: hash,
        createdAt: new Date().toISOString(),
        emailVerified: false,
        verificationToken,
        verificationExpires: tokenExpires,
        profile: { age: null, state: null, country: null }
      };

      saveUsers(users);

      // Create player profile
      const players = loadPlayers();
      players[userId] = {
        userId,
        resources: { wood: 0, food: 0, water: 0, gold: 0, stone: 0 },
        units: [],
        buildings: []
      };
      savePlayers(players);

      console.log(`[EMAIL] Verification token for ${email}: ${verificationToken}`);
      resolve({ userId, verificationToken });
    } catch (err) {
      reject(err);
    }
  });
}

function authenticateUser(email, password) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();
      const user = Object.values(users).find(u => u.email === email);

      if (!user) {
        return resolve(null);
      }

      const match = bcrypt.compareSync(password, user.passwordHash);
      resolve(match ? user.id : null);
    } catch (err) {
      reject(err);
    }
  });
}

function getUserById(userId) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();
      resolve(users[userId] || null);
    } catch (err) {
      reject(err);
    }
  });
}

function loadPlayerData(userId) {
  return new Promise((resolve, reject) => {
    try {
      const players = loadPlayers();
      resolve(players[userId] || null);
    } catch (err) {
      reject(err);
    }
  });
}

function savePlayerData(userId, resources, units, buildings) {
  return new Promise((resolve, reject) => {
    try {
      const players = loadPlayers();
      players[userId] = {
        userId,
        resources,
        units,
        buildings,
        lastSaved: new Date().toISOString()
      };
      savePlayers(players);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function createPasswordResetToken(email) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();
      const user = Object.values(users).find(u => u.email === email);

      if (!user) {
        return resolve(null);
      }

      const token = require('crypto').randomBytes(32).toString('hex');
      user.resetToken = token;
      user.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      saveUsers(users);
      resolve(token);
    } catch (err) {
      reject(err);
    }
  });
}

function resetPassword(email, resetToken, newPassword) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();
      const user = Object.values(users).find(u => u.email === email);

      if (!user || user.resetToken !== resetToken) {
        return resolve(false);
      }

      // Check if token expired
      if (new Date(user.resetTokenExpires) < new Date()) {
        return resolve(false);
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      user.passwordHash = hash;
      user.resetToken = null;
      user.resetTokenExpires = null;

      saveUsers(users);
      resolve(true);
    } catch (err) {
      reject(err);
    }
  });
}

function verifyEmail(verificationToken) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();
      const user = Object.values(users).find(u => u.verificationToken === verificationToken);

      if (!user) {
        return resolve(false);
      }

      // Check if token expired
      if (new Date(user.verificationExpires) < new Date()) {
        return resolve(false);
      }

      user.emailVerified = true;
      user.verificationToken = null;
      user.verificationExpires = null;
      saveUsers(users);
      resolve(true);
    } catch (err) {
      reject(err);
    }
  });
}

function updateUserProfile(userId, age, state, country) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();
      const user = users[userId];
      if (!user) return resolve(false);

      user.profile = { age, state, country };
      saveUsers(users);
      resolve(true);
    } catch (err) {
      reject(err);
    }
  });
}

function deleteUserAccount(userId) {
  return new Promise((resolve, reject) => {
    try {
      const users = loadUsers();
      const players = loadPlayers();

      delete users[userId];
      delete players[userId];

      saveUsers(users);
      savePlayers(players);
      resolve(true);
    } catch (err) {
      reject(err);
    }
  });
}

function cleanupUnverifiedAccounts() {
  try {
    const users = loadUsers();
    const now = new Date();
    let deletedCount = 0;

    Object.keys(users).forEach(userId => {
      const user = users[userId];
      if (!user.emailVerified && user.verificationExpires) {
        if (new Date(user.verificationExpires) < now) {
          console.log(`[CLEANUP] Deleting unverified account: ${user.email}`);
          deleteUserAccount(userId);
          deletedCount++;
        }
      }
    });

    if (deletedCount > 0) {
      console.log(`[CLEANUP] Deleted ${deletedCount} unverified accounts`);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}

// Run cleanup every minute
setInterval(cleanupUnverifiedAccounts, 60 * 1000);

module.exports = {
  registerUser,
  authenticateUser,
  getUserById,
  loadPlayerData,
  savePlayerData,
  createPasswordResetToken,
  resetPassword,
  verifyEmail,
  updateUserProfile,
  deleteUserAccount,
  cleanupUnverifiedAccounts
};
