const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/attendanceController");
router.get("/students", auth, asyncHandler(c.getStudents));
router.get("/summary", auth, asyncHandler(c.getMySummary));
router.get("/", auth, asyncHandler(c.getAttendance));
router.post("/", auth, asyncHandler(c.saveAttendance));
module.exports = router;
