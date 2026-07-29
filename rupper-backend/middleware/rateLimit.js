const { rateLimit } = require("express-rate-limit");

/**
 * Without these, a password can be guessed as fast as the server can answer. Limits are per
 * IP and deliberately generous enough that a person mistyping their password a few times is
 * never affected.
 *
 * `app.set("trust proxy", 1)` in server.js matters here: behind Railway's proxy every
 * request would otherwise look like it came from the same address.
 */

const common = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again." },
};

// Sign-in and sign-up: the endpoints worth guessing against.
const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

// Requesting a reset also sends an email, so it's stricter - both to slow down guessing and
// to stop the form being used to spam somebody's inbox.
const passwordResetLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: "Too many password reset requests. Please wait an hour and try again." },
});

module.exports = { authLimiter, passwordResetLimiter };
