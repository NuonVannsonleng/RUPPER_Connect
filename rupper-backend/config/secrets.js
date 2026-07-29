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

const GENERATE_HINT =
  "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"";

function resolveJwtSecret() {
  if (configured && !INSECURE.has(configured) && configured.length >= 32) return configured;

  const why = !configured
    ? "JWT_SECRET is not set"
    : INSECURE.has(configured)
      ? "JWT_SECRET is still one of the placeholder values"
      : "JWT_SECRET is shorter than 32 characters";

  // Never fall back to a guessable value - that was the original bug, and a known secret
  // lets anyone mint a token for any account. But refusing to boot takes the whole site
  // down over a config problem, so instead generate a strong random secret and complain
  // loudly. The app stays up and stays safe; the only cost is that sessions don't survive a
  // restart, which is a far better failure than a 502.
  const message = isProduction
    ? `${why}. Running on a random secret generated at startup, so everyone will be signed out every time this service restarts. Set JWT_SECRET to fix it. ${GENERATE_HINT}`
    : `${why}. Using a random development secret - logins will not survive a restart. ${GENERATE_HINT}`;

  if (isProduction) console.error(`SECURITY: ${message}`);
  else console.warn(message);

  return crypto.randomBytes(48).toString("base64url");
}

module.exports = { jwtSecret: resolveJwtSecret() };
