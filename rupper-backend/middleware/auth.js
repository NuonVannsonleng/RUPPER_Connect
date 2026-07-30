const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { jwtSecret } = require("../config/secrets");

module.exports = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token provided" });

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // A JWT stays valid until it expires, so on its own a password change would leave any
  // session opened with the old password still working - the opposite of what someone
  // resetting a compromised account expects. Tokens minted before the last password change
  // are refused. `iat` is in seconds; a second of slack covers rounding.
  try {
    const [rows] = await pool.query("SELECT password_changed_at, is_active FROM users WHERE id = ?", [payload.id]);
    if (!rows.length) return res.status(401).json({ message: "Account no longer exists" });

    // A 7-day token issued before an admin deactivates the account would otherwise keep
    // working for the rest of its life - this is what actually cuts off a live session,
    // not just future logins.
    if (Number(rows[0].is_active) === 0) {
      return res.status(403).json({ message: "This account has been deactivated." });
    }

    const changedAt = rows[0].password_changed_at;
    if (changedAt && payload.iat) {
      const changedSeconds = Math.floor(new Date(changedAt).getTime() / 1000);
      if (payload.iat < changedSeconds - 1) {
        return res.status(401).json({ message: "Your password changed. Please sign in again." });
      }
    }
  } catch (error) {
    return next(error);
  }

  req.user = payload;
  next();
};
