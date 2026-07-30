const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/adminController");

// Every route here is admin-only.
router.use(auth, requireAdmin);

router.get("/stats", asyncHandler(c.getStats));
router.get("/email-diagnostics", asyncHandler(c.emailDiagnostics));

router.get("/users", asyncHandler(c.getUsers));
router.post("/users", asyncHandler(c.createUser));
router.get("/users/:id", asyncHandler(c.getUserById));
router.put("/users/:id", asyncHandler(c.updateUserProfile));
router.put("/users/:id/email", asyncHandler(c.updateUserEmail));
router.put("/users/:id/role", asyncHandler(c.updateUserRole));
router.put("/users/:id/status", asyncHandler(c.setUserActive));
router.put("/users/:id/password", asyncHandler(c.setUserPassword));
router.post("/users/:id/send-reset-email", asyncHandler(c.sendResetEmail));
router.delete("/users/:id", asyncHandler(c.deleteUser));

router.get("/courses", asyncHandler(c.getCourses));
router.put("/courses/:id", asyncHandler(c.updateCourse));
router.delete("/courses/:id", asyncHandler(c.deleteCourse));
router.put("/courses/:id/lecturer", asyncHandler(c.assignCourseLecturer));

module.exports = router;
