const bcrypt = require("bcryptjs");
const pool = require("./db");

/**
 * Tracks when each account's password last changed, so sessions opened with the previous
 * one can be refused (see middleware/auth.js). MySQL has no ADD COLUMN IF NOT EXISTS, so
 * check information_schema first.
 */
async function ensurePasswordChangedColumn() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'password_changed_at'`
  );
  if (Number(rows[0].total) === 0) {
    await pool.query("ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL");
  }
}

/**
 * Lets an admin deactivate an account without deleting it. Same lazy-migration approach as
 * ensurePasswordChangedColumn, for databases created before this existed.
 */
async function ensureUserStatusColumn() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'is_active'`
  );
  if (Number(rows[0].total) === 0) {
    await pool.query("ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1");
  }
}

/**
 * Promotes the account named by ADMIN_EMAIL to admin on boot.
 *
 * Public signup refuses the admin role on purpose, and on a hosted database you usually
 * can't reach a shell to run scripts/makeAdmin.js. Setting ADMIN_EMAIL in the host's
 * environment is the way in: only someone who can already change the deployment's config
 * can use it, so it doesn't widen access.
 *
 *   ADMIN_EMAIL=you@rupp.edu.kh                     -> promotes that existing account
 *   ADMIN_EMAIL=... plus ADMIN_PASSWORD=Secret123   -> also creates it if missing
 *
 * Runs on every boot and is a no-op once the account is already an admin, so it's safe to
 * leave the variable in place.
 */
async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!email) return { skipped: true };

  const [rows] = await pool.query("SELECT id, name, role FROM users WHERE email = ?", [email]);

  if (rows.length) {
    if (rows[0].role === "admin") return { alreadyAdmin: true, email };
    await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [rows[0].id]);
    return { promoted: true, email, from: rows[0].role };
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 6) {
    return { missing: true, email };
  }

  const hashed = await bcrypt.hash(password, 10);
  await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')", [
    (process.env.ADMIN_NAME || "Administrator").trim(),
    email,
    hashed,
  ]);
  return { created: true, email };
}

module.exports = { bootstrapAdmin, ensurePasswordChangedColumn, ensureUserStatusColumn };
