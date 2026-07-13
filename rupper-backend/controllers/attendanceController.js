const pool = require("../config/db");

exports.getStudents = async (req, res) => {
  const [rows] = await pool.query("SELECT id, name, email, student_id AS studentId, major, year FROM users WHERE role = 'student' ORDER BY name");
  res.json(rows);
};

exports.getAttendance = async (req, res) => {
  const date = req.query.date;
  let sql = `SELECT a.id, a.student_id AS studentId, u.name AS studentName, a.attendance_date AS date, a.status
             FROM attendance a JOIN users u ON a.student_id = u.id`;
  const params = [];
  if (date) { sql += " WHERE a.attendance_date = ?"; params.push(date); }
  sql += " ORDER BY a.attendance_date DESC, u.name";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
};

exports.getMySummary = async (req, res) => {
  const [rows] = await pool.query(
    "SELECT status, COUNT(*) AS count FROM attendance WHERE student_id = ? GROUP BY status",
    [req.user.id]
  );
  const counts = { present: 0, absent: 0, late: 0 };
  rows.forEach((row) => {
    if (row.status in counts) counts[row.status] = Number(row.count);
  });
  const total = counts.present + counts.absent + counts.late;
  const percentage = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
  res.json({ ...counts, total, percentage });
};

exports.getClassSummary = async (req, res) => {
  const [rows] = await pool.query("SELECT status, COUNT(*) AS count FROM attendance GROUP BY status");
  const counts = { present: 0, absent: 0, late: 0 };
  rows.forEach((row) => {
    if (row.status in counts) counts[row.status] = Number(row.count);
  });
  const total = counts.present + counts.absent + counts.late;
  const percentage = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
  res.json({ ...counts, total, percentage });
};

exports.saveAttendance = async (req, res) => {
  const { date, records } = req.body;
  if (!date || !Array.isArray(records)) return res.status(400).json({ message: "date and records are required" });
  for (const r of records) {
    await pool.query(
      `INSERT INTO attendance (student_id, attendance_date, status, created_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), created_by = VALUES(created_by)`,
      [r.studentId, date, r.status, req.user.id]
    );
  }
  res.json({ message: "Attendance saved" });
};
