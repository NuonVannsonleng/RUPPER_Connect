/**
 * Creates or promotes an admin account.
 *
 * Public signup deliberately refuses the admin role - otherwise anyone could grant
 * themselves one - so the very first admin has to be made here. After that, an admin
 * can manage roles from the Users screen in the app.
 *
 *   node scripts/makeAdmin.js someone@rupp.edu.kh                  # promote existing user
 *   node scripts/makeAdmin.js someone@rupp.edu.kh "StrongPass1" "Full Name"   # create new
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function main() {
  const [emailArg, password, name] = process.argv.slice(2);

  if (!emailArg) {
    console.error("Usage: node scripts/makeAdmin.js <email> [password] [name]");
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const [rows] = await pool.query("SELECT id, name, role FROM users WHERE email = ?", [email]);

  if (rows.length) {
    if (rows[0].role === "admin") {
      console.log(`${email} is already an admin.`);
    } else {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [rows[0].id]);
      console.log(`Promoted ${email} (${rows[0].name}) from ${rows[0].role} to admin.`);
    }
    return;
  }

  if (!password) {
    console.error(`No account found for ${email}. Pass a password to create one:`);
    console.error(`  node scripts/makeAdmin.js ${email} "StrongPass1" "Full Name"`);
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);
  await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')", [
    (name || "Administrator").trim(),
    email,
    hashed,
  ]);
  console.log(`Created admin account ${email}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error.message);
    process.exit(1);
  });
