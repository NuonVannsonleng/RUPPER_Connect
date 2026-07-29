const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const ASSIGNABLE_ROLES = ["student", "teacher", "admin"];

const publicUser = (u) => ({
  id: String(u.id),
  name: u.name,
  email: u.email,
  role: u.role,
  studentId: u.student_id || "",
  major: u.major || "",
  year: u.year || "",
  department: u.department || "",
  createdAt: u.created_at ? String(u.created_at).slice(0, 10) : "",
});

const countOf = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return Number(rows[0]?.total || 0);
};

// Tables owned by the academic module are created lazily on first use, so a fresh
// database may not have them yet. Treat "not there yet" as zero rather than a 500.
const safeCount = async (sql) => {
  try {
    return await countOf(sql);
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return 0;
    throw error;
  }
};

exports.getStats = async (req, res) => {
  const [roleRows] = await pool.query("SELECT role, COUNT(*) AS total FROM users GROUP BY role");
  const byRole = { student: 0, teacher: 0, admin: 0 };
  roleRows.forEach((row) => {
    if (row.role in byRole) byRole[row.role] = Number(row.total);
  });

  const [recentRows] = await pool.query(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC, id DESC LIMIT 5"
  );

  res.json({
    users: {
      total: byRole.student + byRole.teacher + byRole.admin,
      ...byRole,
    },
    courses: await safeCount("SELECT COUNT(*) AS total FROM courses"),
    assignments: await safeCount("SELECT COUNT(*) AS total FROM course_assignments"),
    quizzes: await safeCount("SELECT COUNT(*) AS total FROM quizzes"),
    announcements: await safeCount("SELECT COUNT(*) AS total FROM announcements"),
    attendanceRecords: await safeCount("SELECT COUNT(*) AS total FROM attendance"),
    recentUsers: recentRows.map(publicUser),
  });
};

exports.getUsers = async (req, res) => {
  const { role, search } = req.query;
  const where = [];
  const params = [];

  if (role && ASSIGNABLE_ROLES.includes(role)) {
    where.push("role = ?");
    params.push(role);
  }
  if (search) {
    where.push("(name LIKE ? OR email LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT id, name, email, role, student_id, major, year, department, created_at
     FROM users
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY FIELD(role, 'admin', 'teacher', 'student'), name`,
    params
  );

  res.json(rows.map(publicUser));
};

exports.createUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "name, email, password, and role are required" });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

  const normalizedEmail = email.trim().toLowerCase();
  const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
  if (exists.length) return res.status(409).json({ message: "Email already registered" });

  const hashed = await bcrypt.hash(password, 10);
  const [result] = await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
    name.trim(),
    normalizedEmail,
    hashed,
    role,
  ]);

  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  res.status(201).json(publicUser(rows[0]));
};

exports.updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });

  const targetId = Number(req.params.id);
  // Demoting yourself would immediately lock you out of this screen.
  if (targetId === Number(req.user.id) && role !== "admin") {
    return res.status(400).json({ message: "You cannot change your own admin role" });
  }

  const [target] = await pool.query("SELECT id, role FROM users WHERE id = ?", [targetId]);
  if (!target.length) return res.status(404).json({ message: "User not found" });

  // Never leave the platform with no way back in.
  if (target[0].role === "admin" && role !== "admin") {
    const adminCount = await countOf("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
    if (adminCount <= 1) return res.status(400).json({ message: "Cannot demote the last remaining admin" });
  }

  await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, targetId]);
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [targetId]);
  res.json(publicUser(rows[0]));
};

exports.deleteUser = async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === Number(req.user.id)) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  const [target] = await pool.query("SELECT id, role FROM users WHERE id = ?", [targetId]);
  if (!target.length) return res.status(404).json({ message: "User not found" });

  if (target[0].role === "admin") {
    const adminCount = await countOf("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
    if (adminCount <= 1) return res.status(400).json({ message: "Cannot delete the last remaining admin" });
  }

  await pool.query("DELETE FROM users WHERE id = ?", [targetId]);
  res.json({ message: "User deleted" });
};

exports.getCourses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.code, c.title, c.faculty, c.department, c.semester, c.status,
              c.lecturer_id AS lecturerId, u.name AS lecturerName,
              (SELECT COUNT(*) FROM course_enrollments e WHERE e.course_id = c.id) AS students
       FROM courses c
       LEFT JOIN users u ON u.id = c.lecturer_id
       ORDER BY c.code`
    );
    res.json(
      rows.map((row) => ({
        id: String(row.id),
        code: row.code,
        title: row.title,
        faculty: row.faculty || "",
        department: row.department || "",
        semester: row.semester || "",
        status: row.status,
        lecturerId: row.lecturerId ? String(row.lecturerId) : "",
        lecturerName: row.lecturerName || "Unassigned",
        students: Number(row.students || 0),
      }))
    );
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return res.json([]);
    throw error;
  }
};

exports.assignCourseLecturer = async (req, res) => {
  const { lecturerId } = req.body;

  if (lecturerId) {
    const [teacher] = await pool.query("SELECT id, role FROM users WHERE id = ?", [lecturerId]);
    if (!teacher.length) return res.status(404).json({ message: "User not found" });
    if (!["teacher", "admin"].includes(teacher[0].role)) {
      return res.status(400).json({ message: "Only teachers can be assigned to a course" });
    }
  }

  const [result] = await pool.query("UPDATE courses SET lecturer_id = ? WHERE id = ?", [
    lecturerId || null,
    req.params.id,
  ]);
  if (!result.affectedRows) return res.status(404).json({ message: "Course not found" });

  res.json({ message: lecturerId ? "Lecturer assigned" : "Lecturer cleared" });
};
