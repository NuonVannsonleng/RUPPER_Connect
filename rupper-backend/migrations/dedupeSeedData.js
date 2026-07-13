const pool = require("../config/db");

// One-time cleanup for duplicate rows created by a race condition in academicController's
// seedAcademicData (fixed alongside this migration with a MySQL named lock). Before that fix,
// concurrent first-load requests could each see an empty table and insert their own copy of the
// seed rows. This keeps the oldest row per natural key and removes the rest, but only when the
// duplicate has no real user activity attached (submissions/attempts), so nothing real is lost.
// Safe to run on every boot - once the duplicates are gone, each query matches zero rows.
async function dedupeSeedData() {
  const tableExists = async (name) => {
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [name]
    );
    return Number(rows[0].total) > 0;
  };

  const results = {};

  if (await tableExists("course_assignments")) {
    const [res] = await pool.query(`
      DELETE a FROM course_assignments a
      JOIN (
        SELECT MIN(id) AS keep_id, course_id, title, deadline
        FROM course_assignments
        GROUP BY course_id, title, deadline
        HAVING COUNT(*) > 1
      ) dupes ON dupes.course_id = a.course_id AND dupes.title = a.title AND dupes.deadline = a.deadline
      WHERE a.id <> dupes.keep_id
        AND NOT EXISTS (SELECT 1 FROM assignment_submissions s WHERE s.assignment_id = a.id)
    `);
    results.assignments = res.affectedRows;
  }

  if (await tableExists("quizzes")) {
    const [res] = await pool.query(`
      DELETE q FROM quizzes q
      JOIN (
        SELECT MIN(id) AS keep_id, course_id, title
        FROM quizzes
        GROUP BY course_id, title
        HAVING COUNT(*) > 1
      ) dupes ON dupes.course_id = q.course_id AND dupes.title = q.title
      WHERE q.id <> dupes.keep_id
        AND NOT EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.quiz_id = q.id)
    `);
    results.quizzes = res.affectedRows;
  }

  if (await tableExists("academic_calendar_events")) {
    const [res] = await pool.query(`
      DELETE e FROM academic_calendar_events e
      JOIN (
        SELECT MIN(id) AS keep_id, title, event_date, event_type
        FROM academic_calendar_events
        GROUP BY title, event_date, event_type
        HAVING COUNT(*) > 1
      ) dupes ON dupes.title = e.title AND dupes.event_date = e.event_date AND dupes.event_type = e.event_type
      WHERE e.id <> dupes.keep_id
    `);
    results.calendarEvents = res.affectedRows;
  }

  if (await tableExists("transcript_records")) {
    const [res] = await pool.query(`
      DELETE t FROM transcript_records t
      JOIN (
        SELECT MIN(id) AS keep_id, student_id, semester, course_id, grade_letter
        FROM transcript_records
        GROUP BY student_id, semester, course_id, grade_letter
        HAVING COUNT(*) > 1
      ) dupes ON dupes.student_id = t.student_id AND dupes.semester = t.semester
        AND dupes.course_id <=> t.course_id AND dupes.grade_letter = t.grade_letter
      WHERE t.id <> dupes.keep_id
    `);
    results.transcriptRecords = res.affectedRows;
  }

  return results;
}

module.exports = { dedupeSeedData };
