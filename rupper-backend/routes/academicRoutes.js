const router = require("express").Router();
const auth = require("../middleware/auth");
const requireTeacher = require("../middleware/requireTeacher");
const asyncHandler = require("../middleware/asyncHandler");
const c = require("../controllers/academicController");

router.get("/courses", auth, asyncHandler(c.getCourses));
router.post("/courses", auth, requireTeacher, asyncHandler(c.createCourse));
router.post("/courses/:courseId/materials", auth, requireTeacher, asyncHandler(c.createMaterial));
router.get("/materials/:id/download", auth, asyncHandler(c.downloadMaterial));

router.get("/courses/:courseId/enrollments", auth, requireTeacher, asyncHandler(c.getCourseEnrollments));
router.post("/courses/:courseId/enrollments", auth, requireTeacher, asyncHandler(c.enrollStudent));
router.delete("/courses/:courseId/enrollments/:studentId", auth, requireTeacher, asyncHandler(c.unenrollStudent));

router.get("/assignments", auth, asyncHandler(c.getAssignments));
router.post("/assignments", auth, requireTeacher, asyncHandler(c.createAssignment));
router.post("/assignments/:id/submissions", auth, asyncHandler(c.submitAssignment));
router.get("/assignments/:id/submissions", auth, requireTeacher, asyncHandler(c.getAssignmentSubmissions));
router.get("/assignment-submissions/:id/download", auth, asyncHandler(c.downloadSubmission));
router.put("/assignment-submissions/:id/grade", auth, requireTeacher, asyncHandler(c.gradeSubmission));

router.get("/quizzes", auth, asyncHandler(c.getQuizzes));
router.post("/quizzes", auth, requireTeacher, asyncHandler(c.createQuiz));
// Role-aware rather than teacher-gated: a student gets the same quiz without the answer key.
router.get("/quizzes/:id", auth, asyncHandler(c.getQuizDetail));
router.put("/quizzes/:id", auth, requireTeacher, asyncHandler(c.updateQuiz));
router.delete("/quizzes/:id", auth, requireTeacher, asyncHandler(c.deleteQuiz));
router.post("/quizzes/:id/attempts", auth, asyncHandler(c.submitQuizAttempt));
router.get("/quizzes/:id/results", auth, asyncHandler(c.getQuizResults));

router.get("/calendar", auth, asyncHandler(c.getCalendarEvents));
router.post("/calendar", auth, requireTeacher, asyncHandler(c.createCalendarEvent));
router.put("/calendar/:id", auth, requireTeacher, asyncHandler(c.updateCalendarEvent));
router.delete("/calendar/:id", auth, requireTeacher, asyncHandler(c.deleteCalendarEvent));

router.get("/transcript", auth, asyncHandler(c.getTranscript));
router.get("/risk-alerts", auth, asyncHandler(c.getRiskAlerts));

router.get("/contacts", auth, asyncHandler(c.getContacts));
router.get("/messages", auth, asyncHandler(c.getMessages));
router.post("/messages", auth, asyncHandler(c.createMessage));
router.put("/messages/:id/read", auth, asyncHandler(c.markMessageRead));

router.post("/attendance-sessions", auth, requireTeacher, asyncHandler(c.createAttendanceSession));
router.post("/attendance-sessions/check-in", auth, asyncHandler(c.checkInAttendanceSession));

module.exports = router;
