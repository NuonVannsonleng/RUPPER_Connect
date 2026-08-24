const pool = require("../config/db");

// One-time cleanup for duplicate rows created by a race condition in academicController's
// seedAcademicData (fixed alongside this migration with an advisory lock). Before that fix,
// concurrent first-load requests could each see an empty table and insert their own copy of the
// seed rows. This keeps the oldest row per natural key and removes the rest, but only when the
// duplicate has no real user activity attached (submissions/attempts), so nothing real is lost.
// Safe to run on every boot - once the duplicates are gone, each query matches zero rows.
//
// MySQL's multi-table `DELETE a FROM t a JOIN (...) dupes` has no Postgres equivalent, so each
// of these is expressed as a plain DELETE against a set of ids chosen by a window function.
async function dedupeSeedData() {
  const tableExists = async (name) => {
    const [rows] = await pool.query("SELECT to_regclass(?::text) IS NOT NULL AS present", [`public.${name}`]);
    return Boolean(rows[0].present);
  };

  const results = {};

  if (await tableExists("course_assignments")) {
    const [res] = await pool.query(`
      DELETE FROM course_assignments
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY course_id, title, deadline ORDER BY id) AS rn
          FROM course_assignments
        ) ranked
        WHERE ranked.rn > 1
      )
      AND NOT EXISTS (SELECT 1 FROM assignment_submissions s WHERE s.assignment_id = course_assignments.id)
    `);
    results.assignments = res.affectedRows;
  }

  if (await tableExists("quizzes")) {
    const [res] = await pool.query(`
      DELETE FROM quizzes
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY course_id, title ORDER BY id) AS rn
          FROM quizzes
        ) ranked
        WHERE ranked.rn > 1
      )
      AND NOT EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.quiz_id = quizzes.id)
    `);
    results.quizzes = res.affectedRows;
  }

  if (await tableExists("academic_calendar_events")) {
    const [res] = await pool.query(`
      DELETE FROM academic_calendar_events
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY title, event_date, event_type ORDER BY id) AS rn
          FROM academic_calendar_events
        ) ranked
        WHERE ranked.rn > 1
      )
    `);
    results.calendarEvents = res.affectedRows;
  }

  if (await tableExists("transcript_records")) {
    // PARTITION BY groups NULL course_ids together, which is what the MySQL version's
    // null-safe <=> comparison did.
    const [res] = await pool.query(`
      DELETE FROM transcript_records
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY student_id, semester, course_id, grade_letter ORDER BY id
          ) AS rn
          FROM transcript_records
        ) ranked
        WHERE ranked.rn > 1
      )
    `);
    results.transcriptRecords = res.affectedRows;
  }

  return results;
}

module.exports = { dedupeSeedData };
