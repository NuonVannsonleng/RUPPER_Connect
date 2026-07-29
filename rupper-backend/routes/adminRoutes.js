const router = require("express").Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/adminController");

// Every route here is admin-only.
router.use(auth, requireAdmin);

router.get("/stats", asyncHandler(c.getStats));

router.get("/users", asyncHandler(c.getUsers));
router.post("/users", asyncHandler(c.createUser));
router.put("/users/:id/role", asyncHandler(c.updateUserRole));
router.delete("/users/:id", asyncHandler(c.deleteUser));

router.get("/courses", asyncHandler(c.getCourses));
router.put("/courses/:id/lecturer", asyncHandler(c.assignCourseLecturer));

module.exports = router;
