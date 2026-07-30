const pool = require("../config/db");

let tableReady = false;

// Backs the header bell dropdown's synthetic, per-role reminder items (e.g. "attendance-today"),
// which have no database row of their own to hang a read flag off of - unlike announcements,
// which already track reads via announcement_reads. Keyed by a stable string id per user.
const ensureTable = async () => {
  if (tableReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS notification_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_key VARCHAR(120) NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_notification_read (user_id, notification_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  tableReady = true;
};

exports.getReadKeys = async (req, res) => {
  await ensureTable();
  const [rows] = await pool.query("SELECT notification_key FROM notification_reads WHERE user_id = ?", [req.user.id]);
  res.json(rows.map((row) => row.notification_key));
};

exports.markRead = async (req, res) => {
  await ensureTable();
  const key = String(req.params.key || "").trim();
  if (!key) return res.status(400).json({ message: "notification key is required" });

  await pool.query("INSERT IGNORE INTO notification_reads (user_id, notification_key) VALUES (?, ?)", [
    req.user.id,
    key,
  ]);
  res.json({ message: "Marked as read" });
};
