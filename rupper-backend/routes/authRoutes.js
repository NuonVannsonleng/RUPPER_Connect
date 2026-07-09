const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/authController");
const oauth = require("../controllers/oauthController");

router.post("/signup", asyncHandler(c.signup));
router.post("/login", asyncHandler(c.login));
router.get("/oauth/:provider", asyncHandler(oauth.startOAuth));
router.get("/oauth/:provider/callback", asyncHandler(oauth.handleOAuthCallback));
router.post("/oauth/:provider/callback", asyncHandler(oauth.handleOAuthCallback));
router.get("/me", auth, asyncHandler(c.me));
router.put("/profile", auth, asyncHandler(c.updateProfile));
router.put("/change-password", auth, asyncHandler(c.changePassword));
router.post("/reset-password", asyncHandler(c.resetPassword));

module.exports = router;
