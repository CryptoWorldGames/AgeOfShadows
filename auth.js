const bcrypt = require('bcryptjs');
const { query } = require('./database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./email');

async function registerUser(email, displayName, password, options = {}) {
  try {
    // Check if email exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new Error('Email already registered');
    }

    const userId = Date.now().toString();
    const hash = bcrypt.hashSync(password, 10);
    const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await query(`
      INSERT INTO users (id, email, display_name, password_hash, email_verified, verification_token, verification_expires, wants_emails)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      email,
      displayName || email.split('@')[0],
      hash,
      false,
      verificationToken,
      verificationExpires,
      options.wantsEmails || false
    ]);

    // Create player profile
    await query(`
      INSERT INTO players (user_id)
      VALUES ($1)
    `, [userId]);

    // Send verification email
    sendVerificationEmail(email, verificationToken).catch(err => {
      console.error(`[AUTH] Failed to send verification email to ${email}:`, err.message);
    });

    console.log(`[AUTH] User registered: ${displayName} (${userId}) - Awaiting email verification`);
    return { userId };
  } catch (err) {
    console.error('[AUTH] Registration error:', err.message);
    throw err;
  }
}

async function authenticateUser(email, password) {
  try {
    const result = await query('SELECT id, password_hash FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const match = bcrypt.compareSync(password, user.password_hash);
    return match ? user.id : null;
  } catch (err) {
    console.error('[AUTH] Authentication error:', err.message);
    throw err;
  }
}

async function getUserById(userId) {
  try {
    const result = await query(`
      SELECT id, email, display_name, created_at, email_verified, profile
      FROM users WHERE id = $1
    `, [userId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error('[AUTH] Get user error:', err.message);
    throw err;
  }
}

async function loadPlayerData(userId) {
  try {
    const result = await query(`
      SELECT user_id, resources, units, buildings, build_queue, last_saved
      FROM players WHERE user_id = $1
    `, [userId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error('[AUTH] Load player error:', err.message);
    throw err;
  }
}

async function savePlayerData(userId, resources, units, buildings, buildQueue = []) {
  try {
    await query(`
      UPDATE players
      SET resources = $2, units = $3, buildings = $4, build_queue = $5, last_saved = NOW()
      WHERE user_id = $1
    `, [userId, JSON.stringify(resources), JSON.stringify(units), JSON.stringify(buildings), JSON.stringify(buildQueue)]);
  } catch (err) {
    console.error('[AUTH] Save player error:', err.message);
    throw err;
  }
}

async function createPasswordResetToken(email) {
  try {
    const result = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return null;
    }

    const token = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await query(`
      UPDATE users
      SET reset_token = $2, reset_token_expires = $3
      WHERE email = $1
    `, [email, token, resetTokenExpires]);

    // Send password reset email
    sendPasswordResetEmail(email, token).then(sent => {
      console.log(`[AUTH] Password reset requested: ${email}`);
    });

    return token;
  } catch (err) {
    console.error('[AUTH] Create reset token error:', err.message);
    throw err;
  }
}

async function resetPassword(email, resetToken, newPassword) {
  try {
    const result = await query(`
      SELECT id, reset_token, reset_token_expires
      FROM users WHERE email = $1
    `, [email]);

    if (result.rows.length === 0 || result.rows[0].reset_token !== resetToken) {
      return false;
    }

    const user = result.rows[0];
    if (new Date(user.reset_token_expires) < new Date()) {
      return false;
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await query(`
      UPDATE users
      SET password_hash = $2, reset_token = NULL, reset_token_expires = NULL
      WHERE id = $1
    `, [user.id, hash]);

    return true;
  } catch (err) {
    console.error('[AUTH] Reset password error:', err.message);
    throw err;
  }
}

async function verifyEmail(verificationToken) {
  try {
    const result = await query(`
      SELECT id, verification_expires
      FROM users WHERE verification_token = $1
    `, [verificationToken]);

    if (result.rows.length === 0) {
      return false;
    }

    const user = result.rows[0];
    if (new Date(user.verification_expires) < new Date()) {
      return false;
    }

    await query(`
      UPDATE users
      SET email_verified = true, verification_token = NULL, verification_expires = NULL
      WHERE id = $1
    `, [user.id]);

    return true;
  } catch (err) {
    console.error('[AUTH] Email verification error:', err.message);
    throw err;
  }
}

async function updateUserProfile(userId, age, state, country) {
  try {
    const profile = JSON.stringify({ age, state, country });
    await query(`
      UPDATE users
      SET profile = $2
      WHERE id = $1
    `, [userId, profile]);

    return true;
  } catch (err) {
    console.error('[AUTH] Update profile error:', err.message);
    throw err;
  }
}

async function updateDisplayName(userId, displayName) {
  try {
    await query(`UPDATE users SET display_name = $2 WHERE id = $1`, [userId, displayName.trim()]);
    return true;
  } catch (err) {
    console.error('[AUTH] Update display name error:', err.message);
    throw err;
  }
}

async function deleteUserAccount(userId) {
  try {
    // Player data will be deleted due to CASCADE
    await query('DELETE FROM users WHERE id = $1', [userId]);
    return true;
  } catch (err) {
    console.error('[AUTH] Delete account error:', err.message);
    throw err;
  }
}

async function cleanupUnverifiedAccounts() {
  try {
    const result = await query(`
      DELETE FROM users
      WHERE email_verified = false AND verification_expires < NOW()
      RETURNING email
    `);

    if (result.rows.length > 0) {
      console.log(`[CLEANUP] Deleted ${result.rows.length} unverified accounts`);
      result.rows.forEach(row => console.log(`[CLEANUP] Deleted: ${row.email}`));
    }
  } catch (err) {
    console.error('[CLEANUP] Error:', err.message);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupUnverifiedAccounts, 5 * 60 * 1000);

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
  updateDisplayName,
  deleteUserAccount,
  cleanupUnverifiedAccounts
};
