const router = require("express").Router();
const auth = require("../middleware/auth");
const requireTeacher = require("../middleware/requireTeacher");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/gradeController");
router.get("/", auth, asyncHandler(c.getGrades));
router.post("/", auth, requireTeacher, asyncHandler(c.saveGrades));
module.exports = router;
