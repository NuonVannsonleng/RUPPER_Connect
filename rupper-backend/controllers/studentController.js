const pool = require("../config/db");

exports.deleteStudent = async (req, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  const [rows] = await pool.query("SELECT id, role FROM users WHERE id = ?", [studentId]);
  if (!rows.length) return res.status(404).json({ message: "Student not found" });
  if (rows[0].role !== "student") return res.status(400).json({ message: "Only student accounts can be removed here" });

  await pool.query("DELETE FROM users WHERE id = ? AND role = 'student'", [studentId]);
  res.json({ message: "Student removed" });
};
