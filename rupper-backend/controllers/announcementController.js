const pool = require("../config/db");

const selectAnnouncementById = async (id) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.content, a.category, a.created_at AS createdAt, u.name AS author
     FROM announcements a LEFT JOIN users u ON a.created_by = u.id WHERE a.id = ?`,
    [id]
  );
  return rows[0];
};

exports.getAnnouncements = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.content, a.category, a.created_at AS createdAt, u.name AS author
     FROM announcements a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC`
  );
  res.json(rows);
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
