const router = require("express").Router();
const auth = require("../middleware/auth");
const requireTeacher = require("../middleware/requireTeacher");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/studentController");

router.delete("/:id", auth, requireTeacher, asyncHandler(c.deleteStudent));

module.exports = router;
