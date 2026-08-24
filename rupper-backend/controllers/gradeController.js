const pool = require("../config/db");

exports.getGrades = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT g.id, g.student_id AS "studentId", u.name AS "studentName", g.subject, g.assignment, g.score, g.max_score AS "maxScore"
     FROM grades g JOIN users u ON g.student_id = u.id ORDER BY u.name, g.subject, g.assignment`
  );
  res.json(rows);
};

exports.saveGrades = async (req, res) => {
  const { grades } = req.body;
  if (!Array.isArray(grades)) return res.status(400).json({ message: "grades array is required" });
  for (const g of grades) {
    await pool.query(
      `INSERT INTO grades (student_id, subject, assignment, score, max_score, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (student_id, subject, assignment)
       DO UPDATE SET score = EXCLUDED.score, max_score = EXCLUDED.max_score, created_by = EXCLUDED.created_by`,
      [g.studentId, g.subject, g.assignment, g.score, g.maxScore || 100, req.user.id]
    );
  }
  res.json({ message: "Grades saved" });
};
