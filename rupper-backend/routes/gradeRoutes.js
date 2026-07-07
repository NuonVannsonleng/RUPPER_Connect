const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/gradeController");
router.get("/", auth, asyncHandler(c.getGrades));
router.post("/", auth, asyncHandler(c.saveGrades));
module.exports = router;
