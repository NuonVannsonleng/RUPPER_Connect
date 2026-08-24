const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { isMissingTableError } = require("../db");
const { verifyMailer, isMailerConfigured, mailerFrom, mailerProvider, sendPasswordResetEmail } = require("../services/mailer");
const { createResetToken } = require("../services/passwordReset");

const ASSIGNABLE_ROLES = ["student", "teacher", "admin"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: String(u.id),
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone || "",
  studentId: u.student_id || "",
  major: u.major || "",
  year: u.year || "",
  department: u.department || "",
  office: u.office || "",
  isActive: u.is_active === undefined || u.is_active === null ? true : Boolean(Number(u.is_active)),
  createdAt: u.created_at ? String(u.created_at).slice(0, 10) : "",
});

// The list view intentionally leaves avatar out (it's a base64 blob) - only the single-user
// detail fetch behind "view profile" needs it.
const fullProfileUser = (u) => ({ ...publicUser(u), avatar: u.avatar || "" });

const countOf = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return Number(rows[0]?.total || 0);
};

// A deactivated admin can't log in, so they no longer count as "a way back in" - every guard
// that used to just count role='admin' now needs to count active ones only.
const countActiveAdmins = async (excludeId) =>
  countOf(
    `SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = TRUE${excludeId ? " AND id != ?" : ""}`,
    excludeId ? [excludeId] : []
  );

// Tables owned by the academic module are created lazily on first use, so a fresh
// database may not have them yet. Treat "not there yet" as zero rather than a 500.
const safeCount = async (sql) => {
  try {
    return await countOf(sql);
  } catch (error) {
    if (isMissingTableError(error)) return 0;
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
    // ILIKE, not LIKE: MySQL's default collation made LIKE case-insensitive, Postgres' does not,
    // so a plain LIKE here would silently stop matching "Sophea" when someone types "sophea".
    where.push("(name ILIKE ? OR email ILIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT id, name, email, role, phone, student_id, major, year, department, office, is_active, created_at
     FROM users
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 WHEN 'student' THEN 3 ELSE 4 END, name`,
    params
  );

  res.json(rows.map(publicUser));
};

exports.getUserById = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: "User not found" });
  res.json(fullProfileUser(rows[0]));
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
    const remaining = await countActiveAdmins(targetId);
    if (remaining < 1) return res.status(400).json({ message: "Cannot demote the last remaining admin" });
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
    const remaining = await countActiveAdmins(targetId);
    if (remaining < 1) return res.status(400).json({ message: "Cannot delete the last remaining admin" });
  }

  await pool.query("DELETE FROM users WHERE id = ?", [targetId]);
  res.json({ message: "User deleted" });
};

exports.updateUserProfile = async (req, res) => {
  const { name, phone, studentId, major, year, department, office } = req.body;
  if (typeof name === "string" && !name.trim()) {
    return res.status(400).json({ message: "Name cannot be empty" });
  }

  const [existingRows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ message: "User not found" });

  const current = existingRows[0];
  const next = {
    name: typeof name === "string" && name.trim() ? name.trim() : current.name,
    phone: phone !== undefined ? phone || null : current.phone,
    studentId: studentId !== undefined ? studentId || null : current.student_id,
    major: major !== undefined ? major || null : current.major,
    year: year !== undefined ? year || null : current.year,
    department: department !== undefined ? department || null : current.department,
    office: office !== undefined ? office || null : current.office,
  };

  await pool.query(
    `UPDATE users SET name = ?, phone = ?, student_id = ?, major = ?, year = ?, department = ?, office = ? WHERE id = ?`,
    [next.name, next.phone, next.studentId, next.major, next.year, next.department, next.office, req.params.id]
  );
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
  res.json(fullProfileUser(rows[0]));
};

exports.updateUserEmail = async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) return res.status(400).json({ message: "Email is required" });

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  const targetId = Number(req.params.id);
  const [target] = await pool.query("SELECT id, email FROM users WHERE id = ?", [targetId]);
  if (!target.length) return res.status(404).json({ message: "User not found" });
  if (target[0].email === normalizedEmail) {
    return res.json(fullProfileUser({ ...target[0], email: normalizedEmail }));
  }

  const [exists] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [normalizedEmail, targetId]);
  if (exists.length) return res.status(409).json({ message: "Email already registered to another account" });

  // This IS the login credential, not a separate profile field - the `users` row the login
  // query reads from (authController.login: "SELECT * FROM users WHERE email = ?") is what
  // gets updated here, by this admin-only endpoint. There's no separate auth store to fall
  // out of sync with in this app. JWTs only carry id/role, so an existing session keeps
  // working under the new address without needing to sign in again.
  await pool.query("UPDATE users SET email = ? WHERE id = ?", [normalizedEmail, targetId]);
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [targetId]);
  res.json(fullProfileUser(rows[0]));
};

exports.setUserActive = async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== "boolean") return res.status(400).json({ message: "isActive must be true or false" });

  const targetId = Number(req.params.id);
  if (targetId === Number(req.user.id) && !isActive) {
    return res.status(400).json({ message: "You cannot deactivate your own account" });
  }

  const [target] = await pool.query("SELECT id, role FROM users WHERE id = ?", [targetId]);
  if (!target.length) return res.status(404).json({ message: "User not found" });

  if (target[0].role === "admin" && !isActive) {
    const remaining = await countActiveAdmins(targetId);
    if (remaining < 1) return res.status(400).json({ message: "Cannot deactivate the last active admin" });
  }

  await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [isActive, targetId]);
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [targetId]);
  res.json(publicUser(rows[0]));
};

exports.sendResetEmail = async (req, res) => {
  const [target] = await pool.query("SELECT id, name, email FROM users WHERE id = ?", [req.params.id]);
  if (!target.length) return res.status(404).json({ message: "User not found" });

  if (!isMailerConfigured) {
    return res.status(400).json({ message: 'Email delivery isn\'t configured. Use "Set password" to reset it directly instead.' });
  }

  const created = await createResetToken(target[0].email, req.ip);
  if (!created) {
    return res.status(500).json({ message: "Could not start a reset for this account" });
  }

  const base = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:8080").split(",")[0].trim();
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(created.token)}`;

  // Unlike the public forgot-password endpoint, this doesn't need to hide whether the
  // account exists (the admin already knows - they're looking right at it) or fire in the
  // background for timing safety, so it can just await the send and report what happened.
  try {
    await sendPasswordResetEmail({
      to: created.user.email,
      name: created.user.name,
      resetUrl,
      expiresInMinutes: created.expiresInMinutes,
    });
  } catch (error) {
    return res.status(502).json({ message: `Could not send the email: ${error.message}` });
  }

  res.json({ message: `Reset link sent to ${target[0].email}` });
};

exports.setUserPassword = async (req, res) => {
  // The way back in when email delivery isn't configured, or when someone has lost access
  // to their inbox. Stamping password_changed_at also boots any session that was open on
  // the old password.
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }

  const [target] = await pool.query("SELECT id, name FROM users WHERE id = ?", [req.params.id]);
  if (!target.length) return res.status(404).json({ message: "User not found" });

  const hashed = await bcrypt.hash(newPassword, 12);
  await pool.query("UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?", [
    hashed,
    req.params.id,
  ]);

  res.json({ message: `Password updated for ${target[0].name}. They will need to sign in again.` });
};

exports.emailDiagnostics = async (req, res) => {
  // Reset emails are sent in the background and the public endpoint deliberately says the
  // same thing whatever happens, so a broken mail setup is otherwise invisible without
  // server logs. This gives an admin a straight answer.
  const result = await verifyMailer();

  res.json({
    configured: isMailerConfigured,
    provider: mailerProvider,
    from: mailerFrom || null,
    // Only meaningful for SMTP; the HTTP providers post to their own endpoint.
    host: mailerProvider === "smtp" ? process.env.SMTP_HOST || null : null,
    port: mailerProvider === "smtp" ? Number(process.env.SMTP_PORT || 587) : null,
    ok: result.ok,
    error: result.ok ? null : result.reason,
    code: result.ok ? null : result.code || null,
    hint: result.ok ? null : buildHint(result),
  });
};

const buildHint = (result) => {
  const code = String(result.code || "");
  const reason = String(result.reason || "").toLowerCase();

  if (!isMailerConfigured) {
    return "No provider is set. The most reliable option is BREVO_API_KEY or RESEND_API_KEY - they send over HTTPS, which hosting platforms don't block. SMTP_HOST/SMTP_USER/SMTP_PASSWORD also works where outbound SMTP is allowed.";
  }

  if (!mailerFrom) {
    return "Set MAIL_FROM to the sender address you verified with your provider.";
  }

  if (mailerProvider === "brevo" || mailerProvider === "resend") {
    if (code.startsWith("HTTP_4")) {
      return `The ${mailerProvider} API key was rejected. Check it was copied whole, and that MAIL_FROM is an address you have verified with ${mailerProvider}.`;
    }
    return `Could not reach ${mailerProvider}. Check the API key and that the service is reachable from this host.`;
  }

  // SMTP-specific causes.
  if (code === "ETIMEDOUT" || code === "ESOCKET" || reason.includes("timeout")) {
    return "The connection timed out, which almost always means this host blocks outbound SMTP. Try SMTP_PORT=465; if that also times out, switch to BREVO_API_KEY or RESEND_API_KEY, which send over HTTPS and cannot be blocked this way.";
  }
  if (code === "EAUTH" || reason.includes("username and password") || reason.includes("credentials")) {
    return "The login was rejected. With Gmail you need 2-Step Verification enabled and a 16-character App Password with the spaces removed - your normal password will not work.";
  }
  if (reason.includes("self signed") || reason.includes("certificate")) {
    return "TLS certificate problem. Check SMTP_HOST is spelled correctly and matches the provider's certificate.";
  }
  return "Check SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD against your provider's documentation.";
};

exports.getCourses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.code, c.title, c.faculty, c.department, c.semester, c.status,
              c.credits, c.room, c.schedule_label AS "scheduleLabel", c.description,
              c.lecturer_id AS "lecturerId", u.name AS "lecturerName",
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
        credits: Number(row.credits || 3),
        room: row.room || "",
        schedule: row.scheduleLabel || "",
        description: row.description || "",
        lecturerId: row.lecturerId ? String(row.lecturerId) : "",
        lecturerName: row.lecturerName || "Unassigned",
        students: Number(row.students || 0),
      }))
    );
  } catch (error) {
    if (isMissingTableError(error)) return res.json([]);
    throw error;
  }
};

exports.updateCourse = async (req, res) => {
  const { code, title, faculty, department, credits, semester, room, schedule, description, status } = req.body;
  if (!code || !title) return res.status(400).json({ message: "code and title are required" });

  const validStatuses = ["active", "completed", "archived"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const normalizedCode = code.trim().toUpperCase();
  const [existing] = await pool.query("SELECT id FROM courses WHERE id = ?", [req.params.id]);
  if (!existing.length) return res.status(404).json({ message: "Course not found" });

  const [duplicate] = await pool.query("SELECT id FROM courses WHERE code = ? AND id != ?", [normalizedCode, req.params.id]);
  if (duplicate.length) return res.status(409).json({ message: `A course with code "${normalizedCode}" already exists.` });

  await pool.query(
    `UPDATE courses
     SET code = ?, title = ?, faculty = ?, department = ?, credits = ?, semester = ?, room = ?, schedule_label = ?, description = ?, status = ?
     WHERE id = ?`,
    [
      normalizedCode,
      title.trim(),
      faculty || null,
      department || null,
      credits || 3,
      semester || null,
      room || null,
      schedule || null,
      description || null,
      status || "active",
      req.params.id,
    ]
  );

  res.json({ message: "Course updated" });
};

exports.deleteCourse = async (req, res) => {
  const [result] = await pool.query("DELETE FROM courses WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Course not found" });
  res.json({ message: "Course deleted" });
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
