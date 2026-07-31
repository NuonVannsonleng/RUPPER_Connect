const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { jwtSecret } = require("../config/secrets");
const { createResetToken, consumeResetToken } = require("../services/passwordReset");
const { createEmailChangeRequest, consumeEmailChangeRequest } = require("../services/emailChange");
const { sendPasswordResetEmail, sendEmailChangeVerification, isMailerConfigured } = require("../services/mailer");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const frontendBaseUrl = () =>
  (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:8080").split(",")[0].trim();

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone || "",
  avatar: u.avatar || "",
  studentId: u.student_id || "",
  major: u.major || "",
  year: u.year || "",
  department: u.department || "",
  office: u.office || "",
});

const makeToken = (user) => jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });

exports.signup = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ message: "All fields are required" });
  if (!["student", "teacher"].includes(role)) return res.status(400).json({ message: "Invalid role" });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

  const normalizedEmail = email.trim().toLowerCase();
  const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
  if (exists.length) return res.status(409).json({ message: "Email already registered" });

  const hashed = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name.trim(), normalizedEmail, hashed, role]
  );

  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  const user = publicUser(rows[0]);
  res.status(201).json({ token: makeToken(rows[0]), user });
};

exports.login = async (req, res) => {
  // Sign-in is by email + password; the account's stored role is what counts. The role
  // picker on the form used to have to match, which meant every role needed a button on
  // the login page - including admin. A role isn't a secret, so requiring it added
  // friction without adding security, and it kept admin from signing in quietly.
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
  const found = rows[0];
  if (!found) return res.status(400).json({ message: "Invalid email or password" });

  const ok = await bcrypt.compare(password, found.password);
  if (!ok) return res.status(400).json({ message: "Invalid email or password" });

  // Checked after the password so a deactivated account can't be distinguished from a wrong
  // password by anyone who doesn't already know the correct one.
  if (Number(found.is_active) === 0) {
    return res.status(403).json({ message: "This account has been deactivated. Contact an administrator." });
  }

  res.json({ token: makeToken(found), user: publicUser(found) });
};

exports.me = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(404).json({ message: "User not found" });
  res.json({ user: publicUser(rows[0]) });
};

exports.updateProfile = async (req, res) => {
  const { name, phone, avatar, studentId, major, year, department, office } = req.body;
  const [existingRows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!existingRows.length) return res.status(404).json({ message: "User not found" });

  const current = existingRows[0];
  const next = {
    name: typeof name === "string" && name.trim() ? name.trim() : current.name,
    phone: phone !== undefined ? phone || null : current.phone,
    avatar: avatar !== undefined ? avatar || null : current.avatar,
    studentId: studentId !== undefined ? studentId || null : current.student_id,
    major: major !== undefined ? major || null : current.major,
    year: year !== undefined ? year || null : current.year,
    department: department !== undefined ? department || null : current.department,
    office: office !== undefined ? office || null : current.office,
  };

  await pool.query(
    `UPDATE users SET name = ?, phone = ?, avatar = ?, student_id = ?, major = ?, year = ?, department = ?, office = ? WHERE id = ?`,
    [next.name, next.phone, next.avatar, next.studentId, next.major, next.year, next.department, next.office, req.user.id]
  );
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  res.json({ user: publicUser(rows[0]) });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(404).json({ message: "User not found" });
  const ok = await bcrypt.compare(currentPassword, rows[0].password);
  if (!ok) return res.status(400).json({ message: "Current password is incorrect" });
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }
  const hashed = await bcrypt.hash(newPassword, 12);
  // Stamping the change is what lets auth reject sessions opened with the old password.
  await pool.query("UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?", [hashed, req.user.id]);
  res.json({ message: "Password changed successfully" });
};

// Deliberately identical whether or not the address is registered, so this can't be used
// to find out who has an account.
const RESET_REQUESTED_MESSAGE =
  "If that email has an account, a reset link is on its way. The link expires in 30 minutes.";

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const created = await createResetToken(email, req.ip);

  if (created) {
    const resetUrl = `${frontendBaseUrl()}/reset-password?token=${encodeURIComponent(created.token)}`;

    // Deliberately not awaited. Handing the mail off in the background keeps the reply
    // instant; waiting on the SMTP round trip made the form sit on "Sending..." for as long
    // as delivery took, and hang outright when the connection was being filtered. It also
    // removes a timing signal - a registered address took visibly longer than an unknown
    // one, which quietly undid the point of the identical wording below.
    sendPasswordResetEmail({
      to: created.user.email,
      name: created.user.name,
      resetUrl,
      expiresInMinutes: created.expiresInMinutes,
    }).catch((error) => {
      console.error(`Password reset email to ${created.user.email} failed:`, error.message);
    });
  }

  res.json({ message: RESET_REQUESTED_MESSAGE, emailConfigured: isMailerConfigured });
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: "Reset link and new password are required" });
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  const result = await consumeResetToken(token, hashed);

  if (!result.ok) {
    // One message for invalid / already used / expired: telling them apart would let
    // someone probe which tokens once existed.
    return res.status(400).json({ message: "This reset link is invalid or has expired. Please request a new one." });
  }

  res.json({ message: "Password updated. Please sign in with your new password." });
};

exports.requestEmailChange = async (req, res) => {
  const { newEmail, currentPassword } = req.body;
  if (!newEmail || !currentPassword) {
    return res.status(400).json({ message: "New email and current password are required" });
  }

  const normalizedEmail = String(newEmail).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  const current = rows[0];
  if (!current) return res.status(404).json({ message: "User not found" });

  // Re-authenticated here, server-side, against the stored hash. A password only checked in
  // the browser would let anyone with an open session (or a stolen token, since this app has
  // no separate step-up auth) change the email without actually knowing it.
  const passwordOk = await bcrypt.compare(currentPassword, current.password);
  if (!passwordOk) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  if (normalizedEmail === current.email) {
    return res.status(400).json({ message: "That's already your email address" });
  }

  const [exists] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [normalizedEmail, req.user.id]);
  if (exists.length) {
    return res.status(409).json({ message: "That email is already in use on another account" });
  }

  // Unlike a password reset, there's no admin-assisted fallback for "prove you own this new
  // inbox" - so if there's no way to actually deliver the link, fail clearly up front instead
  // of creating a token that can never be redeemed.
  if (!isMailerConfigured) {
    return res.status(400).json({
      message: "Email delivery isn't set up, so email changes can't be verified right now. Ask an administrator for help.",
    });
  }

  const created = await createEmailChangeRequest(req.user.id, normalizedEmail, req.ip);
  const confirmUrl = `${frontendBaseUrl()}/confirm-email?token=${encodeURIComponent(created.token)}`;

  // Awaited (unlike the forgot-password flow, which backgrounds the send) because the caller
  // is already authenticated as this account - there's no anonymous-probing concern to hide
  // behind an instant, identical-looking response, and they need to actually know whether the
  // link went out before they go check an inbox that may never receive anything.
  try {
    await sendEmailChangeVerification({
      to: normalizedEmail,
      name: current.name,
      confirmUrl,
      expiresInMinutes: created.expiresInMinutes,
    });
  } catch (error) {
    return res.status(502).json({ message: `Could not send the confirmation email: ${error.message}` });
  }

  res.json({
    message: `Confirmation link sent to ${normalizedEmail}. Your sign-in email stays ${current.email} until you confirm it. The link expires in ${created.expiresInMinutes} minutes.`,
  });
};

exports.confirmEmailChange = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: "Confirmation link is required" });

  const result = await consumeEmailChangeRequest(token);
  if (!result.ok) {
    // Invalid/expired/used are deliberately worded the same - telling them apart would let
    // someone probe which tokens once existed. "taken" gets its own message since it's an
    // outcome the person can act on (pick a different address), not something that reveals
    // anything about a specific token's history.
    const message =
      result.reason === "taken"
        ? "That email is already in use on another account. Request the change again with a different address."
        : "This confirmation link is invalid or has expired. Please request a new one.";
    return res.status(400).json({ message });
  }

  // No auth middleware on this route - opening the link, which only ever reached the new
  // inbox, is the proof. Returning a fresh session means confirming signs the account in
  // immediately with the updated email, even from a brand new tab that never held a token.
  res.json({ token: makeToken(result.user), user: publicUser(result.user), message: "Email updated." });
};
