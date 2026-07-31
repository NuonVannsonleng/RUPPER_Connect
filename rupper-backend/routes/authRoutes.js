const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/authController");
const oauth = require("../controllers/oauthController");
const { authLimiter, passwordResetLimiter, emailChangeLimiter } = require("../middleware/rateLimit");

router.post("/signup", authLimiter, asyncHandler(c.signup));
router.post("/login", authLimiter, asyncHandler(c.login));
router.get("/oauth/status", asyncHandler(oauth.oauthStatus));
router.get("/oauth/:provider", asyncHandler(oauth.startOAuth));
router.get("/oauth/:provider/callback", asyncHandler(oauth.handleOAuthCallback));
router.post("/oauth/:provider/callback", asyncHandler(oauth.handleOAuthCallback));
router.get("/me", auth, asyncHandler(c.me));
router.put("/profile", auth, asyncHandler(c.updateProfile));
router.put("/change-password", auth, asyncHandler(c.changePassword));

// Two steps now: ask for a link, then redeem it. The old single-call reset that took an
// email and a new password is gone - knowing an address was enough to seize an account.
router.post("/forgot-password", passwordResetLimiter, asyncHandler(c.forgotPassword));
router.post("/reset-password", passwordResetLimiter, asyncHandler(c.resetPassword));

// Same two-step shape: request (authenticated, password-checked) mails a link to the NEW
// address, confirm (not authenticated - the token from that email is the proof) applies it.
router.post("/email-change/request", auth, emailChangeLimiter, asyncHandler(c.requestEmailChange));
router.post("/email-change/confirm", emailChangeLimiter, asyncHandler(c.confirmEmailChange));

module.exports = router;
