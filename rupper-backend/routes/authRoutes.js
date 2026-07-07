const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/authController");

router.post("/signup", asyncHandler(c.signup));
router.post("/login", asyncHandler(c.login));
router.get("/me", auth, asyncHandler(c.me));
router.put("/profile", auth, asyncHandler(c.updateProfile));
router.put("/change-password", auth, asyncHandler(c.changePassword));
router.post("/reset-password", asyncHandler(c.resetPassword));

module.exports = router;
