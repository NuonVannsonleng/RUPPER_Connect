/**
 * Every token this app issues is signed with JWT_SECRET. The code used to fall back to the
 * literal string "dev_secret" when the variable was missing - and that string is public in
 * the repository, so anyone could have forged a token for any account, including an admin.
 * A missing secret in production is now a startup failure rather than a silent downgrade.
 *
 * Outside production a development-only secret is generated so `npm run dev` still works on
 * a fresh clone; it changes each restart, which just means existing logins stop working.
 */
const crypto = require("crypto");

const isProduction = process.env.NODE_ENV === "production";
const configured = (process.env.JWT_SECRET || "").trim();

const INSECURE = new Set(["dev_secret", "change_this_to_a_long_secret_key", "secret", "changeme"]);

function resolveJwtSecret() {
  if (configured && !INSECURE.has(configured) && configured.length >= 32) return configured;

  if (isProduction) {
    const why = !configured
      ? "JWT_SECRET is not set"
      : INSECURE.has(configured)
        ? "JWT_SECRET is still one of the placeholder values"
        : "JWT_SECRET is shorter than 32 characters";
    throw new Error(
      `Refusing to start: ${why}. Anyone who knows the value can mint a token for any ` +
        "account. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  }

  if (configured) {
    console.warn(
      "JWT_SECRET is weak or a placeholder. Fine locally, but production will refuse to start until it is a random 32+ character value."
    );
    return configured;
  }

  console.warn("JWT_SECRET is not set. Using a random development secret - logins will not survive a restart.");
  return crypto.randomBytes(48).toString("base64url");
}

module.exports = { jwtSecret: resolveJwtSecret() };
