const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/notificationController");

router.get("/read", auth, asyncHandler(c.getReadKeys));
router.put("/:key/read", auth, asyncHandler(c.markRead));

module.exports = router;
