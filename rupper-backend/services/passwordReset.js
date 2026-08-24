const crypto = require("crypto");
const pool = require("../config/db");

/**
 * Token-based password reset.
 *
 * The old flow took an email and a new password and changed the account there and then,
 * which meant knowing somebody's address was enough to take over their account. This
 * replaces it with a token the requester has to actually receive.
 *
 * Properties worth keeping if this is ever edited:
 *  - the token is random (32 bytes) and only ever leaves here once, in the email
 *  - only a SHA-256 hash is stored, so a leaked database can't be used to reset anything
 *  - single use, and short lived
 *  - requesting a reset never reveals whether an address has an account
 *  - using one invalidates that account's other outstanding tokens
 */

const TOKEN_TTL_MINUTES = 30;
const MAX_ACTIVE_TOKENS = 3;

let tableReady = false;

const ensureTable = async () => {
  if (tableReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    requested_ip VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_reset_user_active ON password_reset_tokens (user_id, used_at)");
  tableReady = true;
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Creates a reset token for the address if an account exists. Returns the raw token so the
 * caller can deliver it, or null when there's no such account - callers must respond
 * identically either way so this can't be used to discover which addresses are registered.
 */
async function createResetToken(email, requestedIp) {
  await ensureTable();

  const [users] = await pool.query("SELECT id, name, email FROM users WHERE email = ?", [
    String(email).trim().toLowerCase(),
  ]);
  if (!users.length) return null;

  const user = users[0];

  // Someone spamming the form shouldn't be able to leave dozens of usable tokens lying
  // around; keep only the most recent few alive.
  const [active] = await pool.query(
    "SELECT id FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC",
    [user.id]
  );
  if (active.length >= MAX_ACTIVE_TOKENS) {
    const staleIds = active.slice(MAX_ACTIVE_TOKENS - 1).map((row) => row.id);
    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ANY(?)", [staleIds]);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip)
     VALUES (?, ?, NOW() + (?::int * INTERVAL '1 minute'), ?)`,
    [user.id, hashToken(token), TOKEN_TTL_MINUTES, requestedIp || null]
  );

  return { token, user, expiresInMinutes: TOKEN_TTL_MINUTES };
}

/**
 * Consumes a token and sets the new password. Returns the user id on success, or a reason
 * string - deliberately the same wording to the client either way, so a wrong token and an
 * expired one are indistinguishable.
 */
async function consumeResetToken(token, hashedPassword) {
  await ensureTable();

  const [rows] = await pool.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = ?`,
    [hashToken(String(token || ""))]
  );

  const record = rows[0];
  if (!record) return { ok: false, reason: "invalid" };
  if (record.used_at) return { ok: false, reason: "used" };
  if (new Date(record.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };

  await pool.query("UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?", [
    hashedPassword,
    record.user_id,
  ]);

  // Burn this token and any other outstanding ones for the account.
  await pool.query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
    [record.user_id]
  );

  return { ok: true, userId: record.user_id };
}

module.exports = { createResetToken, consumeResetToken, ensureTable, TOKEN_TTL_MINUTES };
