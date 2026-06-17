const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function initializeDatabase() {
  try {
    console.log('[DB] Checking database schema...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        display_name VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email_verified BOOLEAN DEFAULT false,
        verification_token VARCHAR(255),
        verification_expires TIMESTAMP,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        profile JSONB DEFAULT '{"age":null,"state":null,"country":null}',
        wants_emails BOOLEAN DEFAULT false
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        resources JSONB DEFAULT '{"wood":0,"food":0,"water":0,"gold":0,"stone":0}',
        units JSONB DEFAULT '[]',
        buildings JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_saved TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[DB] Schema initialized successfully');
  } catch (err) {
    console.error('[DB] Schema initialization error:', err.message);
    throw err;
  }
}

async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    throw err;
  }
}

async function getConnection() {
  return pool.connect();
}

module.exports = {
  pool,
  query,
  getConnection,
  initializeDatabase
};
