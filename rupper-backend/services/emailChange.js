const crypto = require("crypto");
const pool = require("../config/db");

/**
 * Token-based email change, mirroring services/passwordReset.js:
 *
 *  - the token is random (32 bytes) and only ever leaves here once, in the email sent to the
 *    NEW address - proving receipt there is what authorizes the change
 *  - only a SHA-256 hash is stored, so a leaked database can't be used to redeem anything
 *  - single use, short lived, and requesting a new change burns any previous pending one for
 *    that account (only the most recent request can ever be valid)
 *  - the account keeps signing in with its current address until the link is opened
 */

const TOKEN_TTL_MINUTES = 30;

let tableReady = false;

const ensureTable = async () => {
  if (tableReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS email_change_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    new_email VARCHAR(120) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    requested_ip VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_token_hash (token_hash),
    KEY idx_user_active (user_id, used_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  tableReady = true;
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

/** Creates a pending change and returns the raw token so the caller can email it. */
async function createEmailChangeRequest(userId, newEmail, requestedIp) {
  await ensureTable();

  // Only one pending change makes sense at a time - burn anything still outstanding first,
  // so an old link can't resurrect a stale request after a newer one was made.
  await pool.query("UPDATE email_change_requests SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [userId]);

  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO email_change_requests (user_id, new_email, token_hash, expires_at, requested_ip)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
    [userId, newEmail, hashToken(token), TOKEN_TTL_MINUTES, requestedIp || null]
  );

  return { token, expiresInMinutes: TOKEN_TTL_MINUTES };
}

/**
 * Redeems a token and applies the email change. Returns the updated user row on success, or a
 * reason string - deliberately the same wording to the client either way (see authController),
 * so a wrong token and an expired one are indistinguishable.
 */
async function consumeEmailChangeRequest(token) {
  await ensureTable();

  const [rows] = await pool.query(
    `SELECT id, user_id, new_email, expires_at, used_at FROM email_change_requests WHERE token_hash = ?`,
    [hashToken(String(token || ""))]
  );

  const record = rows[0];
  if (!record) return { ok: false, reason: "invalid" };
  if (record.used_at) return { ok: false, reason: "used" };
  if (new Date(record.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };

  // Re-check uniqueness at confirm time too, in case someone else claimed the address in the
  // meantime - the request-time check alone can't guarantee that's still true 30 minutes later.
  const [taken] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [record.new_email, record.user_id]);
  if (taken.length) return { ok: false, reason: "taken" };

  await pool.query("UPDATE users SET email = ? WHERE id = ?", [record.new_email, record.user_id]);
  await pool.query("UPDATE email_change_requests SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [record.user_id]);

  const [userRows] = await pool.query("SELECT * FROM users WHERE id = ?", [record.user_id]);
  return { ok: true, user: userRows[0] };
}

module.exports = { createEmailChangeRequest, consumeEmailChangeRequest, ensureTable };
