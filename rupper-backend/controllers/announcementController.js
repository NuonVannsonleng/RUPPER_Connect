const pool = require("../config/db");

let readsTableReady = false;

const ensureReadsTable = async () => {
  if (readsTableReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS announcement_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_announcement_read (announcement_id, user_id),
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  readsTableReady = true;
};

const selectAnnouncementById = async (id) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.content, a.category, a.created_at AS createdAt, u.name AS author
     FROM announcements a LEFT JOIN users u ON a.created_by = u.id WHERE a.id = ?`,
    [id]
  );
  return rows[0];
};

exports.getAnnouncements = async (req, res) => {
  await ensureReadsTable();
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.content, a.category, a.created_at AS createdAt, u.name AS author,
      EXISTS(SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = ?) AS isRead
     FROM announcements a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC`,
    [req.user.id]
  );
  res.json(rows.map((row) => ({ ...row, isRead: Boolean(row.isRead) })));
};

exports.markAnnouncementRead = async (req, res) => {
  await ensureReadsTable();
  await pool.query("INSERT IGNORE INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)", [
    req.params.id,
    req.user.id,
  ]);
  res.json({ message: "Marked as read" });
};

exports.createAnnouncement = async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ message: "title and content are required" });
  const [result] = await pool.query(
    "INSERT INTO announcements (title, content, category, created_by) VALUES (?, ?, ?, ?)",
    [title, content, category || "general", req.user.id]
  );
  res.status(201).json(await selectAnnouncementById(result.insertId));
};

exports.updateAnnouncement = async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ message: "title and content are required" });

  const [result] = await pool.query(
    "UPDATE announcements SET title = ?, content = ?, category = ? WHERE id = ?",
    [title.trim(), content.trim(), category || "general", req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Announcement not found" });

  res.json(await selectAnnouncementById(req.params.id));
};

exports.deleteAnnouncement = async (req, res) => {
  const [result] = await pool.query("DELETE FROM announcements WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Announcement not found" });
  res.json({ message: "Announcement deleted" });
};
