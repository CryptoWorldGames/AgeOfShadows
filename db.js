const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'game.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('SQLite database connected at', dbPath);
});

function initDatabase() {
  db.serialize(() => {
    // Users table: username, password hash, created date
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Player data table: resources, units, buildings, progress
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        resources_wood INTEGER DEFAULT 0,
        resources_food INTEGER DEFAULT 0,
        resources_water INTEGER DEFAULT 0,
        resources_gold INTEGER DEFAULT 0,
        resources_stone INTEGER DEFAULT 0,
        units_data TEXT DEFAULT '[]',
        buildings_data TEXT DEFAULT '[]',
        last_login DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  });
}

function registerUser(username, password) {
  return new Promise((resolve, reject) => {
    const hash = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash],
      function(err) {
        if (err) return reject(err);
        const userId = this.lastID;
        // Create player profile
        db.run(
          `INSERT INTO players (user_id) VALUES (?)`,
          [userId],
          (err) => {
            if (err) reject(err);
            else resolve(userId);
          }
        );
      }
    );
  });
}

function authenticateUser(username, password) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, password_hash FROM users WHERE username = ?',
      [username],
      (err, user) => {
        if (err) return reject(err);
        if (!user) return resolve(null);
        const match = bcrypt.compareSync(password, user.password_hash);
        resolve(match ? user.id : null);
      }
    );
  });
}

function loadPlayerData(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM players WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        const data = {
          resources: {
            wood: row.resources_wood,
            food: row.resources_food,
            water: row.resources_water,
            gold: row.resources_gold,
            stone: row.resources_stone
          },
          units: row.units_data ? JSON.parse(row.units_data) : [],
          buildings: row.buildings_data ? JSON.parse(row.buildings_data) : []
        };
        resolve(data);
      }
    );
  });
}

function savePlayerData(userId, resources, units, buildings) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE players SET
        resources_wood = ?,
        resources_food = ?,
        resources_water = ?,
        resources_gold = ?,
        resources_stone = ?,
        units_data = ?,
        buildings_data = ?,
        last_login = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        resources.wood,
        resources.food,
        resources.water,
        resources.gold,
        resources.stone,
        JSON.stringify(units),
        JSON.stringify(buildings),
        userId
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, username FROM users WHERE username = ?',
      [username],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

module.exports = {
  db,
  initDatabase,
  registerUser,
  authenticateUser,
  loadPlayerData,
  savePlayerData,
  getUserByUsername
};
