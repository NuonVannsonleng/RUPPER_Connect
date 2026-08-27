const pool = require("../config/db");
const { withAdvisoryLock, isDuplicateKeyError } = require("../db");

// Arbitrary but fixed keys for pg_advisory_xact_lock - the Postgres replacement for the
// MySQL named locks this module used to take (GET_LOCK('rupper_academic_schema', ...)).
const ACADEMIC_SCHEMA_LOCK = 811001;
const ACADEMIC_SEED_LOCK = 811002;

let schemaReady = false;
// In-flight de-duplication, so the several dashboard requests that arrive together do the
// one-time schema and seed work once between them rather than once each.
let schemaPromise = null;
let sharedSeedPromise = null;
const studentSeedPromises = new Map();

// "slides" is a legacy value from before Document/Presentation/Spreadsheet existed - old rows
// keep working, they just render with the Presentation label rather than needing a data migration.
const MATERIAL_TYPE_ALIASES = {
  pdf: "pdf",
  document: "document",
  doc: "document",
  presentation: "presentation",
  slides: "presentation",
  spreadsheet: "spreadsheet",
  sheet: "spreadsheet",
  image: "image",
  video: "video",
  link: "link",
  file: "file",
};

const materialTypeToDb = (value = "file") => MATERIAL_TYPE_ALIASES[String(value).toLowerCase()] || "file";

const materialTypeToUi = (value = "file") => {
  const labels = {
    pdf: "PDF",
    document: "Document",
    presentation: "Presentation",
    slides: "Presentation",
    spreadsheet: "Spreadsheet",
    image: "Image",
    video: "Video",
    link: "Link",
    file: "File",
  };
  return labels[value] || "File";
};

const dateOnly = (value) => {
  if (!value) return "";
  // db.js parses DATE/TIMESTAMP straight through as raw 'YYYY-MM-DD[ HH:MM:SS]' strings -
  // take the date portion directly rather than round-tripping through a JS Date,
  // which would reinterpret it in the server's local timezone and can shift it by a day.
  const str = String(value);
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? str.slice(0, 10) : date.toISOString().slice(0, 10);
};

const shortDate = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(date);
};

const timeAgo = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
};

const ensureAcademicSchema = async () => {
  if (schemaReady) return;

  // The dashboard fires courses, assignments, quizzes and calendar together, so this is hit
  // by several requests at once. They share one in-flight promise rather than each queueing
  // for the lock - across processes the advisory lock still serialises, but within this one
  // the work happens exactly once. On failure the promise is cleared so the next request
  // retries instead of inheriting the error forever.
  if (!schemaPromise) {
    schemaPromise = withAdvisoryLock(ACADEMIC_SCHEMA_LOCK, ensureAcademicSchemaLocked)
      .then(() => {
        schemaReady = true;
      })
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }

  await schemaPromise;
};

// `query` is bound to the connection holding the lock - see withAdvisoryLock in db.js.
// Using the pool here instead would deadlock.
const ensureAcademicSchemaLocked = async (query) => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS courses (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      title VARCHAR(160) NOT NULL,
      faculty VARCHAR(120),
      department VARCHAR(120),
      lecturer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      credits INTEGER DEFAULT 3,
      semester VARCHAR(80),
      room VARCHAR(80),
      schedule_label VARCHAR(120),
      description TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS course_enrollments (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      progress DECIMAL(5,2) DEFAULT 0,
      attendance_percentage DECIMAL(5,2) DEFAULT 0,
      current_grade DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_course_student UNIQUE (course_id, student_id)
    )`,
    `CREATE TABLE IF NOT EXISTS course_materials (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(180) NOT NULL,
      material_type VARCHAR(20) NOT NULL DEFAULT 'file',
      file_url TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS course_assignments (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(180) NOT NULL,
      description TEXT,
      deadline TIMESTAMP NOT NULL,
      max_score DECIMAL(6,2) DEFAULT 100,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      assignment_id INTEGER NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_url TEXT,
      status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','late','missing','graded')),
      score DECIMAL(6,2),
      feedback TEXT,
      graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      graded_at TIMESTAMP NULL,
      CONSTRAINT unique_assignment_submission UNIQUE (assignment_id, student_id)
    )`,
    `CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(180) NOT NULL,
      description TEXT,
      time_limit_minutes INTEGER DEFAULT 20,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft','available','closed')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL CHECK (question_type IN ('mcq','true_false')),
      options_json JSONB,
      correct_answer VARCHAR(255) NOT NULL,
      points DECIMAL(5,2) DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answers_json JSONB,
      score DECIMAL(6,2),
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      submitted_at TIMESTAMP NULL
    )`,
    `CREATE TABLE IF NOT EXISTS academic_calendar_events (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      event_date DATE NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('exam','assignment','holiday','event')),
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS transcript_records (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      semester VARCHAR(80) NOT NULL,
      credits INTEGER NOT NULL,
      grade_letter VARCHAR(5) NOT NULL,
      grade_point DECIMAL(3,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(180),
      body TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS announcement_reads (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_announcement_read UNIQUE (announcement_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      code VARCHAR(80) NOT NULL UNIQUE,
      starts_at TIMESTAMP NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // course_materials and assignment_submissions predate file uploads, so CREATE TABLE
    // IF NOT EXISTS above won't add the blob columns to a database that already has them.
    // Postgres has ADD COLUMN IF NOT EXISTS, so this needs no information_schema lookup.
    `ALTER TABLE course_materials
       ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
       ADD COLUMN IF NOT EXISTS file_mime VARCHAR(150),
       ADD COLUMN IF NOT EXISTS file_data BYTEA,
       ADD COLUMN IF NOT EXISTS file_size INTEGER`,
    `ALTER TABLE assignment_submissions
       ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
       ADD COLUMN IF NOT EXISTS file_mime VARCHAR(150),
       ADD COLUMN IF NOT EXISTS file_data BYTEA,
       ADD COLUMN IF NOT EXISTS file_size INTEGER,
       ADD COLUMN IF NOT EXISTS graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL`,
    // A scheduled quiz opens and closes on its own. TIMESTAMPTZ rather than the plain
    // TIMESTAMP used elsewhere in this schema: these two are compared against "now" to decide
    // whether a student may sit the quiz, so they have to name an instant rather than a wall
    // clock reading whose zone is anybody's guess.
    `ALTER TABLE quizzes
       ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ`,
    // MySQL indexes every foreign key automatically; Postgres does not, so the move silently
    // dropped the indexes behind most of the joins below. Without these, every dashboard
    // query sequential-scans the whole table.
    `CREATE INDEX IF NOT EXISTS idx_enrollments_student ON course_enrollments (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_materials_course ON course_materials (course_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assignments_course ON course_assignments (course_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON course_assignments (deadline)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions (quiz_id)`,
    `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_student ON quiz_attempts (quiz_id, student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_date ON academic_calendar_events (event_date)`,
    `CREATE INDEX IF NOT EXISTS idx_transcripts_student ON transcript_records (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id)`,
    `CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON courses (lecturer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)`,
  ];

  for (const statement of statements) {
    await query(statement);
  }
};

const resolveCourseId = async (courseId) => {
  const numeric = Number(courseId);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;

  const normalized = String(courseId || "").trim().toLowerCase();
  const [rows] = await pool.query("SELECT id FROM courses WHERE LOWER(code) = ? OR LOWER(REPLACE(code, ' ', '')) = ?", [
    normalized,
    normalized,
  ]);
  return rows[0]?.id || null;
};

/**
 * Puts demo content in front of a brand new database so the dashboard isn't empty.
 *
 * Six endpoints call this and the frontend requests them in parallel, so the shape matters
 * as much as the content. It used to take the advisory lock and re-run every COUNT on every
 * single request forever, which serialised the whole dashboard behind one lock - roughly ten
 * round trips per endpoint, six endpoints deep, on every page load.
 *
 * Now the shared content is seeded once per process and each student's enrolments once per
 * student, both de-duplicated by an in-flight promise so parallel callers share one run.
 * Steady state costs nothing: no lock, no queries.
 */
const seedAcademicData = async (user) => {
  await ensureAcademicSchema();

  if (!sharedSeedPromise) {
    sharedSeedPromise = withAdvisoryLock(ACADEMIC_SEED_LOCK, (query) => seedSharedData(query, user)).catch((error) => {
      sharedSeedPromise = null;
      throw error;
    });
  }
  await sharedSeedPromise;

  if (user.role !== "student") return;

  let pending = studentSeedPromises.get(user.id);
  if (!pending) {
    pending = withAdvisoryLock(ACADEMIC_SEED_LOCK, (query) => seedStudentData(query, user)).catch((error) => {
      studentSeedPromises.delete(user.id);
      throw error;
    });
    studentSeedPromises.set(user.id, pending);
  }
  await pending;
};

// `query` is bound to the connection holding the lock - see withAdvisoryLock in db.js.
const seedSharedData = async (query, user) => {
  const [courseCountRows] = await query("SELECT COUNT(*) AS total FROM courses");
  if (Number(courseCountRows[0].total) === 0) {
    const lecturerId = user.role === "teacher" ? user.id : null;
    const courses = [
      ["CS301", "Database Systems", "Faculty of Engineering", "Information Technology Engineering", lecturerId, 3, "Year 2 - Semester 2", "Lab 204", "Monday 08:00 - 09:30", "Relational design, SQL, transactions, indexing, and database-backed application development."],
      ["SE220", "Software Engineering", "Faculty of Engineering", "Data Science Engineering", lecturerId, 3, "Year 2 - Semester 2", "R-305", "Tuesday 10:00 - 11:30", "Requirements, agile delivery, testing, software design, and team project workflows."],
      ["AI210", "Applied AI for Learning", "Faculty of Science", "Computer Science", lecturerId, 3, "Year 2 - Semester 2", "Lab 101", "Wednesday 13:00 - 14:30", "Practical AI concepts, model evaluation, responsible AI, and classroom-focused applications."],
    ];

    for (const course of courses) {
      await query(
        `INSERT INTO courses
          (code, title, faculty, department, lecturer_id, credits, semester, room, schedule_label, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title`,
        course
      );
    }
  }

  const [courses] = await query("SELECT id, code FROM courses ORDER BY id");
  const byCode = Object.fromEntries(courses.map((course) => [course.code, course.id]));

  const [materialCount] = await query("SELECT COUNT(*) AS total FROM course_materials");
  if (Number(materialCount[0].total) === 0 && courses.length) {
    const materials = [
      [byCode.CS301, "ER Modeling Guide", "pdf"],
      [byCode.CS301, "SQL Joins Lab", "slides"],
      [byCode.SE220, "Agile Sprint Template", "link"],
      [byCode.SE220, "Testing Strategy Notes", "pdf"],
      [byCode.AI210, "Model Evaluation Slides", "slides"],
      [byCode.AI210, "Responsible AI Case Study", "pdf"],
    ].filter(([courseId]) => courseId);

    for (const [courseId, title, type] of materials) {
      await query(
        "INSERT INTO course_materials (course_id, title, material_type, created_by) VALUES (?, ?, ?, ?)",
        [courseId, title, type, user.id]
      );
    }
  }

  const [assignmentCount] = await query("SELECT COUNT(*) AS total FROM course_assignments");
  if (Number(assignmentCount[0].total) === 0 && courses.length) {
    const assignments = [
      [byCode.CS301, "Library Database Design", "Design a normalized schema for a small library system.", "2026-07-18 23:59:00", 100],
      [byCode.CS301, "Transaction Isolation Report", "Explain transaction isolation levels with examples.", "2026-07-24 23:59:00", 50],
      [byCode.SE220, "Project Milestone 2", "Submit sprint demo notes and test plan.", "2026-07-20 23:59:00", 100],
      [byCode.AI210, "Dataset Reflection", "Reflect on dataset quality and responsible AI risks.", "2026-07-13 23:59:00", 40],
    ].filter(([courseId]) => courseId);

    for (const row of assignments) {
      await query(
        "INSERT INTO course_assignments (course_id, title, description, deadline, max_score, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [...row, user.id]
      );
    }
  }

  const [quizCount] = await query("SELECT COUNT(*) AS total FROM quizzes");
  if (Number(quizCount[0].total) === 0 && courses.length) {
    const quizzes = [
      [byCode.CS301, "SQL Fundamentals", "MCQ and true/false SQL check.", 25, "available"],
      [byCode.SE220, "Testing and QA", "Software testing knowledge check.", 20, "available"],
      [byCode.AI210, "Responsible AI Check", "Responsible AI concepts.", 15, "draft"],
    ].filter(([courseId]) => courseId);

    for (const [courseId, title, description, minutes, status] of quizzes) {
      const [result] = await query(
        "INSERT INTO quizzes (course_id, title, description, time_limit_minutes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [courseId, title, description, minutes, status, user.id]
      );
      await query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, correct_answer, points)
         VALUES (?, ?, 'mcq', '["A","B","C","D"]'::jsonb, 'A', 1),
                (?, ?, 'true_false', '["True","False"]'::jsonb, 'True', 1)`,
        [result.insertId, `${title} sample MCQ`, result.insertId, `${title} sample true or false`]
      );
    }
  }

  const [calendarCount] = await query("SELECT COUNT(*) AS total FROM academic_calendar_events");
  if (Number(calendarCount[0].total) === 0) {
    const events = [
      ["Database Midterm Exam", "2026-07-22", "exam", byCode.CS301, "urgent"],
      ["Project Milestone 2 Due", "2026-07-20", "assignment", byCode.SE220, "high"],
      ["University Research Forum", "2026-07-27", "event", null, "normal"],
      ["Constitution Day Holiday", "2026-09-24", "holiday", null, "normal"],
    ];
    for (const event of events) {
      await query(
        "INSERT INTO academic_calendar_events (title, event_date, event_type, course_id, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [...event, user.id]
      );
    }
  }

};

/** Enrolments and a starter transcript, which exist per student rather than once globally. */
const seedStudentData = async (query, user) => {
  const [courses] = await query("SELECT id, code FROM courses ORDER BY id");
  if (!courses.length) return;

  const byCode = Object.fromEntries(courses.map((course) => [course.code, course.id]));

  // One statement for every course rather than one round trip each.
  await query(
    `INSERT INTO course_enrollments (course_id, student_id, progress, attendance_percentage, current_grade)
     SELECT id, ?, 72, 94, 86 FROM courses
     ON CONFLICT (course_id, student_id) DO NOTHING`,
    [user.id]
  );

  const [transcriptCount] = await query("SELECT COUNT(*) AS total FROM transcript_records WHERE student_id = ?", [user.id]);
  if (Number(transcriptCount[0].total) === 0) {
    const records = [
      [null, "Year 1 - Semester 1", 3, "B+", 3.3],
      [null, "Year 1 - Semester 1", 3, "A-", 3.7],
      [byCode.CS301 || null, "Year 2 - Semester 2", 3, "A-", 3.7],
      [byCode.SE220 || null, "Year 2 - Semester 2", 3, "B+", 3.3],
    ];
    for (const row of records) {
      await query(
        "INSERT INTO transcript_records (student_id, course_id, semester, credits, grade_letter, grade_point) VALUES (?, ?, ?, ?, ?, ?)",
        [user.id, ...row]
      );
    }
  }
};

exports.getCourses = async (req, res) => {
  await seedAcademicData(req.user);

  const [courses] = await pool.query(
    `SELECT c.*, u.name AS "lecturerName", u.email AS "lecturerEmail"
     FROM courses c
     LEFT JOIN users u ON c.lecturer_id = u.id
     ORDER BY c.code`
  );
  const ids = courses.map((course) => course.id);
  if (!ids.length) return res.json([]);

  const [materials] = await pool.query(
    `SELECT m.id, m.course_id, m.title, m.material_type, m.file_url, m.file_name, m.file_size, m.file_mime, m.created_at,
      creator.name AS "createdByName"
     FROM course_materials m
     LEFT JOIN users creator ON creator.id = m.created_by
     WHERE m.course_id = ANY(?) ORDER BY m.created_at DESC`,
    [ids]
  );
  const [assignments] = await pool.query(
    `SELECT a.*, creator.name AS "createdByName"
     FROM course_assignments a
     LEFT JOIN users creator ON creator.id = a.created_by
     WHERE a.course_id = ANY(?) ORDER BY a.deadline`,
    [ids]
  );
  const [quizzes] = await pool.query(
    `SELECT q.*, creator.name AS "createdByName"
     FROM quizzes q
     LEFT JOIN users creator ON creator.id = q.created_by
     WHERE q.course_id = ANY(?) ORDER BY q.created_at DESC`,
    [ids]
  );
  const [metrics] = await pool.query(
    `SELECT course_id, AVG(progress) AS progress, AVG(attendance_percentage) AS attendance, AVG(current_grade) AS grade
     FROM course_enrollments WHERE course_id = ANY(?) GROUP BY course_id`,
    [ids]
  );

  const materialMap = new Map();
  materials.forEach((item) => {
    const list = materialMap.get(item.course_id) || [];
    list.push({
      id: String(item.id),
      title: item.title,
      type: materialTypeToUi(item.material_type),
      uploadedAt: shortDate(item.created_at),
      fileName: item.file_name || undefined,
      fileSize: item.file_size || undefined,
      fileMime: item.file_mime || undefined,
      fileUrl: item.material_type === "link" ? item.file_url || undefined : undefined,
      downloadUrl: item.file_name ? `/academic/materials/${item.id}/download` : undefined,
      createdByName: item.createdByName || undefined,
    });
    materialMap.set(item.course_id, list);
  });

  const assignmentMap = new Map();
  assignments.forEach((item) => {
    const list = assignmentMap.get(item.course_id) || [];
    list.push({
      id: String(item.id),
      courseId: String(item.course_id),
      courseCode: courses.find((course) => course.id === item.course_id)?.code || "",
      title: item.title,
      deadline: dateOnly(item.deadline),
      maxScore: Number(item.max_score || 100),
      status: "pending",
      submissionCount: 0,
      createdByName: item.createdByName || undefined,
    });
    assignmentMap.set(item.course_id, list);
  });

  const quizMap = new Map();
  quizzes.forEach((item) => {
    const list = quizMap.get(item.course_id) || [];
    list.push({
      id: String(item.id),
      courseId: String(item.course_id),
      courseCode: courses.find((course) => course.id === item.course_id)?.code || "",
      title: item.title,
      questionTypes: ["MCQ", "True/False"],
      questions: 2,
      timeLimit: Number(item.time_limit_minutes || 20),
      status: item.status === "draft" ? "draft" : "available",
      averageScore: 0,
      createdByName: item.createdByName || undefined,
    });
    quizMap.set(item.course_id, list);
  });

  const metricMap = new Map(metrics.map((item) => [item.course_id, item]));

  res.json(
    courses.map((course) => {
      const metric = metricMap.get(course.id) || {};
      return {
        id: String(course.id),
        code: course.code,
        title: course.title,
        faculty: course.faculty || "",
        department: course.department || "",
        lecturer: course.lecturerName || "Teacher TBA",
        lecturerEmail: course.lecturerEmail || "",
        credits: Number(course.credits || 3),
        semester: course.semester || "",
        room: course.room || "",
        schedule: course.schedule_label || "",
        progress: Math.round(Number(metric.progress || 0)),
        attendance: Math.round(Number(metric.attendance || 0)),
        grade: Math.round(Number(metric.grade || 0)),
        status: course.status === "completed" ? "completed" : "active",
        description: course.description || "",
        materials: materialMap.get(course.id) || [],
        assignments: assignmentMap.get(course.id) || [],
        quizzes: quizMap.get(course.id) || [],
        discussionCount: 0,
      };
    })
  );
};

exports.createCourse = async (req, res) => {
  await ensureAcademicSchema();
  const { code, title, faculty, department, credits, semester, room, schedule, description } = req.body;
  if (!code || !title) return res.status(400).json({ message: "code and title are required" });

  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO courses (code, title, faculty, department, lecturer_id, credits, semester, room, schedule_label, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code.trim().toUpperCase(),
        title.trim(),
        faculty || null,
        department || null,
        req.user.id,
        credits || 3,
        semester || null,
        room || null,
        schedule || null,
        description || null,
      ]
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ message: `A course with code "${code.trim().toUpperCase()}" already exists.` });
    }
    throw error;
  }

  res.status(201).json({ id: String(result.insertId), message: "Course created" });
};

const MAX_MATERIAL_BYTES = 8 * 1024 * 1024; // 8MB, stored directly in the database
const MAX_SUBMISSION_BYTES = 15 * 1024 * 1024; // 15MB, stored directly in the database
const ALLOWED_SUBMISSION_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv",
  "zip", "rar", "7z", "png", "jpg", "jpeg", "gif",
  "py", "js", "ts", "java", "c", "cpp", "h", "cs", "rb", "go", "php", "html", "css", "json",
]);
// Course materials get a tighter allow-list than submissions - no archives or source code,
// just the file types a class actually hands out, prioritizing common school formats.
const ALLOWED_MATERIAL_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv",
  "png", "jpg", "jpeg", "gif", "webp",
  "mp4", "webm", "mov", "m4v",
]);

/**
 * The content type a file is served with is derived here from its (already allow-listed)
 * extension, never from the `fileMime` the uploader sends.
 *
 * Trusting the client's value was exploitable: the upload check only looks at the extension,
 * so a file called `notes.pdf` could be sent with `fileMime: "text/html"` and HTML content.
 * The preview dialog fetches the file and hands the blob to URL.createObjectURL, which takes
 * its type from the stored mime - and a `blob:` URL in an iframe runs in the *app's* origin,
 * so the uploaded markup would execute with access to the signed-in viewer's localStorage
 * token. Anything not listed here is served as a download rather than a renderable type.
 */
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const mimeForExtension = (extension) => MIME_BY_EXTENSION[extension] || "application/octet-stream";

const mimeForFileName = (fileName) => mimeForExtension(String(fileName || "").split(".").pop()?.toLowerCase());

/**
 * Sends a file held in the database with a content type derived from its name rather than the
 * stored one, so rows written before that was enforced are served safely too.
 *
 * The filename is stripped of quotes and control characters before it reaches the header:
 * a CR or LF in a stored name would otherwise either split the response or (on current Node)
 * throw and turn a download into a 500.
 */
const sendStoredFile = (res, fileName, data) => {
  const safeName = String(fileName).replace(/["\\]/g, "").replace(/[\r\n\t\x00-\x1f\x7f]/g, " ").trim() || "download";
  res.setHeader("Content-Type", mimeForFileName(fileName));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  res.send(data);
};

exports.createMaterial = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.params.courseId);
  // fileMime is deliberately not read from the body - see mimeForExtension.
  const { title, type, fileUrl, fileName, fileData } = req.body;
  if (!courseId || !title) return res.status(400).json({ message: "courseId and title are required" });

  let buffer = null;
  let storedMime = null;
  if (fileData) {
    const extension = String(fileName || "").split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_MATERIAL_EXTENSIONS.has(extension)) {
      return res.status(400).json({
        message: "That file type isn't allowed. Upload a PDF, Word, PowerPoint, Excel, image, or video file.",
      });
    }

    buffer = Buffer.from(fileData, "base64");
    if (buffer.length > MAX_MATERIAL_BYTES) {
      return res.status(413).json({ message: "File is too large. Maximum size is 8MB." });
    }

    storedMime = mimeForExtension(extension);
  }

  const [result] = await pool.query(
    `INSERT INTO course_materials
      (course_id, title, material_type, file_url, file_name, file_mime, file_data, file_size, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      courseId,
      title.trim(),
      materialTypeToDb(type),
      buffer ? null : fileUrl || null,
      buffer ? fileName || title.trim() : null,
      storedMime,
      buffer,
      buffer ? buffer.length : null,
      req.user.id,
    ]
  );

  res.status(201).json({ id: String(result.insertId), message: "Material uploaded" });
};

exports.downloadMaterial = async (req, res) => {
  const [rows] = await pool.query(
    "SELECT title, file_name, file_mime, file_data FROM course_materials WHERE id = ?",
    [req.params.id]
  );
  const material = rows[0];
  if (!material || !material.file_data) return res.status(404).json({ message: "File not found" });

  // Re-derived on the way out as well as on the way in, so rows stored before the mime was
  // pinned to the extension can't still be served as a renderable type.
  sendStoredFile(res, material.file_name || material.title, material.file_data);
};

exports.getCourseEnrollments = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.params.courseId);
  if (!courseId) return res.status(404).json({ message: "Course not found" });

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.student_id AS "studentId"
     FROM course_enrollments ce
     JOIN users u ON u.id = ce.student_id
     WHERE ce.course_id = ?
     ORDER BY u.name`,
    [courseId]
  );
  res.json(rows.map((row) => ({ id: String(row.id), name: row.name, email: row.email, studentId: row.studentId || "" })));
};

exports.enrollStudent = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.params.courseId);
  if (!courseId) return res.status(404).json({ message: "Course not found" });

  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: "studentId is required" });

  const [student] = await pool.query("SELECT id, role FROM users WHERE id = ?", [studentId]);
  if (!student.length) return res.status(404).json({ message: "Student not found" });
  if (student[0].role !== "student") return res.status(400).json({ message: "Only students can be enrolled" });

  await pool.query(
    `INSERT INTO course_enrollments (course_id, student_id) VALUES (?, ?)
     ON CONFLICT (course_id, student_id) DO NOTHING`,
    [courseId, studentId]
  );
  res.status(201).json({ message: "Student enrolled" });
};

exports.unenrollStudent = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.params.courseId);
  if (!courseId) return res.status(404).json({ message: "Course not found" });

  const [result] = await pool.query("DELETE FROM course_enrollments WHERE course_id = ? AND student_id = ?", [
    courseId,
    req.params.studentId,
  ]);
  if (!result.affectedRows) return res.status(404).json({ message: "Enrollment not found" });
  res.json({ message: "Student removed from course" });
};

exports.getAssignments = async (req, res) => {
  await seedAcademicData(req.user);

  const [rows] = await pool.query(
    `SELECT a.*, c.code AS "courseCode", creator.name AS "createdByName",
      COUNT(s.id) AS "submissionCount",
      mine.id AS "submissionId",
      mine.status AS "submissionStatus",
      mine.score,
      mine.feedback,
      mine.file_name AS "fileName",
      mine.submitted_at AS "submittedAt"
     FROM course_assignments a
     JOIN courses c ON a.course_id = c.id
     LEFT JOIN users creator ON creator.id = a.created_by
     LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
     LEFT JOIN assignment_submissions mine ON mine.assignment_id = a.id AND mine.student_id = ?
     GROUP BY a.id, c.code, creator.name, mine.id, mine.status, mine.score, mine.feedback, mine.file_name, mine.submitted_at
     ORDER BY a.deadline`,
    [req.user.id]
  );

  res.json(
    rows.map((row) => ({
      id: String(row.id),
      courseId: String(row.course_id),
      courseCode: row.courseCode,
      title: row.title,
      deadline: dateOnly(row.deadline),
      maxScore: Number(row.max_score || 100),
      status: row.submissionStatus || "pending",
      submittedAt: row.submittedAt ? dateOnly(row.submittedAt) : undefined,
      score: row.score === null ? undefined : Number(row.score),
      feedback: row.feedback || undefined,
      submissionCount: Number(row.submissionCount || 0),
      submissionId: row.submissionId ? String(row.submissionId) : undefined,
      fileName: row.fileName || undefined,
      downloadUrl: row.submissionId ? `/academic/assignment-submissions/${row.submissionId}/download` : undefined,
      createdByName: row.createdByName || undefined,
    }))
  );
};

exports.createAssignment = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.body.courseId);
  const { title, description, deadline, maxScore } = req.body;
  if (!courseId || !title || !deadline) return res.status(400).json({ message: "courseId, title, and deadline are required" });

  const [result] = await pool.query(
    "INSERT INTO course_assignments (course_id, title, description, deadline, max_score, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [courseId, title.trim(), description || null, deadline, maxScore || 100, req.user.id]
  );

  res.status(201).json({ id: String(result.insertId), message: "Assignment created" });
};

exports.submitAssignment = async (req, res) => {
  await ensureAcademicSchema();

  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students can submit assignments" });
  }

  // fileMime is deliberately not read from the body - see mimeForExtension.
  const { fileName, fileData } = req.body;
  if (!fileData || !fileName) {
    return res.status(400).json({ message: "Choose a file to submit" });
  }

  const extension = String(fileName).split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_SUBMISSION_EXTENSIONS.has(extension)) {
    return res.status(400).json({
      message: "That file type isn't allowed. Upload a document, spreadsheet, presentation, image, archive, or common source-code file.",
    });
  }

  const buffer = Buffer.from(fileData, "base64");
  if (buffer.length > MAX_SUBMISSION_BYTES) {
    return res.status(413).json({ message: "File is too large. Maximum size is 15MB." });
  }

  const [assignmentRows] = await pool.query("SELECT course_id FROM course_assignments WHERE id = ?", [req.params.id]);
  const assignment = assignmentRows[0];
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });

  const [enrollmentRows] = await pool.query(
    "SELECT id FROM course_enrollments WHERE course_id = ? AND student_id = ?",
    [assignment.course_id, req.user.id]
  );
  if (!enrollmentRows.length) {
    return res.status(403).json({ message: "You are not enrolled in this course" });
  }

  // A resubmission replaces the previous file outright (the unique assignment+student
  // constraint means there's only ever one row) rather than keeping version history, and
  // clears any prior grade since that grade was for a different file.
  await pool.query(
    `INSERT INTO assignment_submissions (assignment_id, student_id, file_name, file_mime, file_data, file_size, status)
     VALUES (?, ?, ?, ?, ?, ?, 'submitted')
     ON CONFLICT (assignment_id, student_id) DO UPDATE SET
       file_name = EXCLUDED.file_name, file_mime = EXCLUDED.file_mime, file_data = EXCLUDED.file_data,
       file_size = EXCLUDED.file_size, status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
       score = NULL, feedback = NULL, graded_at = NULL, graded_by = NULL`,
    [req.params.id, req.user.id, fileName, mimeForExtension(extension), buffer, buffer.length]
  );

  res.status(201).json({ message: "Assignment submitted" });
};

exports.getAssignmentSubmissions = async (req, res) => {
  await ensureAcademicSchema();
  const [rows] = await pool.query(
    `SELECT s.id, s.student_id AS "studentId", u.name AS "studentName", u.email AS "studentEmail",
      s.file_name AS "fileName", s.file_size AS "fileSize", s.status, s.score, s.feedback, s.submitted_at AS "submittedAt",
      grader.name AS "gradedByName"
     FROM assignment_submissions s
     JOIN users u ON u.id = s.student_id
     LEFT JOIN users grader ON grader.id = s.graded_by
     WHERE s.assignment_id = ?
     ORDER BY s.submitted_at DESC`,
    [req.params.id]
  );

  res.json(
    rows.map((row) => ({
      id: String(row.id),
      studentId: String(row.studentId),
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      fileName: row.fileName || undefined,
      fileSize: row.fileSize || undefined,
      downloadUrl: row.fileName ? `/academic/assignment-submissions/${row.id}/download` : undefined,
      status: row.status,
      score: row.score === null ? undefined : Number(row.score),
      feedback: row.feedback || undefined,
      submittedAt: row.submittedAt ? dateOnly(row.submittedAt) : undefined,
      gradedByName: row.gradedByName || undefined,
    }))
  );
};

exports.downloadSubmission = async (req, res) => {
  const [rows] = await pool.query(
    "SELECT student_id, file_name, file_mime, file_data FROM assignment_submissions WHERE id = ?",
    [req.params.id]
  );
  const submission = rows[0];
  if (!submission || !submission.file_data) return res.status(404).json({ message: "File not found" });

  const isOwner = Number(submission.student_id) === Number(req.user.id);
  const isStaff = req.user.role === "teacher" || req.user.role === "admin";
  if (!isOwner && !isStaff) {
    return res.status(403).json({ message: "You don't have access to this file" });
  }

  sendStoredFile(res, submission.file_name || "submission", submission.file_data);
};

exports.gradeSubmission = async (req, res) => {
  await ensureAcademicSchema();
  const { score, feedback } = req.body;
  if (score === undefined) return res.status(400).json({ message: "score is required" });
  const [result] = await pool.query(
    "UPDATE assignment_submissions SET score = ?, feedback = ?, status = 'graded', graded_at = CURRENT_TIMESTAMP, graded_by = ? WHERE id = ?",
    [score, feedback || null, req.user.id, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Submission not found" });
  res.json({ message: "Submission graded" });
};

const QUIZ_STATUSES = new Set(["draft", "available", "closed"]);
const QUESTION_TYPE_SET = new Set(["mcq", "true_false"]);
const MAX_QUIZ_QUESTIONS = 100;
const MAX_QUIZ_OPTIONS = 8;
const TRUE_FALSE_OPTIONS = ["True", "False"];

/** Teachers and admins both author quizzes; admins get the same reach as a teacher elsewhere too. */
const canManageQuizzes = (user) => user?.role === "teacher" || user?.role === "admin";

/**
 * What a published quiz actually is at this moment, once its schedule is taken into account.
 *
 * `status` is the teacher's intent and the window is when that intent applies, so a quiz can be
 * published yet not open yet, or published and already finished, without anyone having to come
 * back and flip a switch. A quiz with no window set behaves exactly as it did before.
 *
 * Exported through __testing - every read and write path leans on this, so it is worth pinning
 * down directly rather than through the endpoints.
 */
const quizAvailability = (quiz, now = new Date()) => {
  const opensAt = quiz.opens_at ? new Date(quiz.opens_at) : null;
  const closesAt = quiz.closes_at ? new Date(quiz.closes_at) : null;

  if (quiz.status === "draft") return { state: "draft", opensAt, closesAt };
  // A quiz closed by hand stays closed even if its window says otherwise.
  if (quiz.status === "closed") return { state: "closed", opensAt, closesAt };

  if (opensAt && now < opensAt) return { state: "scheduled", opensAt, closesAt };
  if (closesAt && now >= closesAt) return { state: "closed", opensAt, closesAt };
  return { state: "available", opensAt, closesAt };
};

/**
 * Seconds a student actually has, which is the shorter of the quiz's own countdown and
 * whatever is left of the window. Starting a 30 minute quiz five minutes before it closes
 * gives five minutes, not thirty.
 */
const secondsAllowed = (quiz, now = new Date()) => {
  const limit = Number(quiz.time_limit_minutes || 20) * 60;
  if (!quiz.closes_at) return limit;
  const untilClose = Math.floor((new Date(quiz.closes_at).getTime() - now.getTime()) / 1000);
  return Math.max(0, Math.min(limit, untilClose));
};

/** Timestamps leave as explicit UTC ISO strings - see the SQL note on isoUtc below. */
const isoOrNull = (value) => (value ? new Date(value).toISOString() : null);

/**
 * db.js parses every timestamp type straight through as text, so a TIMESTAMPTZ would arrive as
 * something like "2026-08-25 07:30:00+00" - which not every browser's Date parser accepts.
 * Selecting it through to_char in UTC gives an unambiguous ISO 8601 instant instead.
 */
const isoUtc = (column, alias) =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "${alias}"`;

/** Parses one end of the window from the request. Empty means "no bound", which is valid. */
const readSchedulePoint = (value, label) => {
  if (value === undefined || value === null || value === "") return { value: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { error: `${label} isn't a valid date and time` };
  return { value: parsed.toISOString() };
};

/**
 * Validates and normalises the question set sent by a teacher.
 *
 * Everything the grader later relies on is established here: the type is one of the two the
 * schema allows, an MCQ has at least two distinct options, and the correct answer is one of
 * those options rather than free text that nothing could ever match. Returning the reason as a
 * string keeps the callers to a single shape - `{ error }` or `{ questions }`.
 */
const normalizeQuizQuestions = (raw) => {
  if (raw === undefined) return { questions: null }; // caller decides whether that's allowed
  if (!Array.isArray(raw)) return { error: "questions must be a list" };
  if (raw.length > MAX_QUIZ_QUESTIONS) return { error: `A quiz can have at most ${MAX_QUIZ_QUESTIONS} questions` };

  const questions = [];
  for (const [index, item] of raw.entries()) {
    const position = index + 1;
    const text = String(item?.question ?? item?.questionText ?? "").trim();
    if (!text) return { error: `Question ${position} needs some text` };

    const type = String(item?.type ?? item?.questionType ?? "mcq").toLowerCase();
    if (!QUESTION_TYPE_SET.has(type)) return { error: `Question ${position} has an unknown type` };

    const points = Number(item?.points ?? 1);
    if (!Number.isFinite(points) || points <= 0 || points > 1000) {
      return { error: `Question ${position} needs a points value between 1 and 1000` };
    }

    let options;
    if (type === "true_false") {
      options = [...TRUE_FALSE_OPTIONS];
    } else {
      const provided = Array.isArray(item?.options) ? item.options.map((o) => String(o ?? "").trim()) : [];
      options = provided.filter(Boolean);
      if (options.length < 2) return { error: `Question ${position} needs at least two answer options` };
      if (options.length > MAX_QUIZ_OPTIONS) {
        return { error: `Question ${position} can have at most ${MAX_QUIZ_OPTIONS} options` };
      }
      if (new Set(options).size !== options.length) {
        return { error: `Question ${position} has duplicate options` };
      }
    }

    const correctAnswer = String(item?.correctAnswer ?? "").trim();
    if (!correctAnswer) return { error: `Question ${position} needs a correct answer marked` };
    if (!options.includes(correctAnswer)) {
      return { error: `The correct answer for question ${position} has to be one of its options` };
    }

    questions.push({ text, type, options, correctAnswer, points });
  }

  return { questions };
};

/** Replaces a quiz's question set outright. Callers have already validated the input. */
const writeQuizQuestions = async (quizId, questions) => {
  await pool.query("DELETE FROM quiz_questions WHERE quiz_id = ?", [quizId]);
  for (const question of questions) {
    await pool.query(
      `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, correct_answer, points)
       VALUES (?, ?, ?, ?::jsonb, ?, ?)`,
      [quizId, question.text, question.type, JSON.stringify(question.options), question.correctAnswer, question.points]
    );
  }
};

const readQuizQuestions = async (quizId) => {
  const [rows] = await pool.query(
    "SELECT id, question_text, question_type, options_json, correct_answer, points FROM quiz_questions WHERE quiz_id = ? ORDER BY id",
    [quizId]
  );
  return rows.map((row) => ({
    id: String(row.id),
    question: row.question_text,
    type: row.question_type,
    options: Array.isArray(row.options_json) ? row.options_json : TRUE_FALSE_OPTIONS,
    correctAnswer: row.correct_answer,
    points: Number(row.points || 1),
  }));
};

/** The shape a student is allowed to see: the same question without the answer key. */
const withoutAnswerKey = ({ correctAnswer, ...rest }) => rest;

/**
 * Marks a set of answers against the questions they belong to. Pure, so it can be tested
 * without a database - see test/quizGrading.test.mjs.
 *
 * Answers come in keyed by question id. A question with no answer, or one naming an option
 * that doesn't exist, scores zero rather than throwing: a student who runs out of time still
 * gets a graded attempt. The comparison is exact against the stored option text, which is what
 * the student was given to choose from, so "true" never quietly counts as "True".
 */
const gradeQuizAnswers = (questions, submitted = {}) => {
  const detail = questions.map((question) => {
    const raw = submitted[question.id];
    const chosen = raw === undefined || raw === null ? null : String(raw);
    const isCorrect = chosen !== null && chosen === question.correctAnswer;
    return {
      questionId: question.id,
      question: question.question,
      type: question.type,
      options: question.options,
      chosen,
      correctAnswer: question.correctAnswer,
      isCorrect,
      points: question.points,
      earned: isCorrect ? question.points : 0,
    };
  });

  return {
    detail,
    score: detail.reduce((total, item) => total + item.earned, 0),
    maxScore: questions.reduce((total, question) => total + question.points, 0),
    correctCount: detail.filter((item) => item.isCorrect).length,
  };
};

const loadQuizOr404 = async (req, res) => {
  const quizId = Number(req.params.id);
  if (!Number.isInteger(quizId) || quizId <= 0) {
    res.status(400).json({ message: "Invalid quiz" });
    return null;
  }
  const [rows] = await pool.query(
    `SELECT q.*, c.code AS "courseCode", creator.name AS "createdByName",
       ${isoUtc("q.opens_at", "opensAtIso")}, ${isoUtc("q.closes_at", "closesAtIso")}
     FROM quizzes q JOIN courses c ON c.id = q.course_id
     LEFT JOIN users creator ON creator.id = q.created_by
     WHERE q.id = ?`,
    [quizId]
  );
  if (!rows.length) {
    res.status(404).json({ message: "Quiz not found" });
    return null;
  }
  // db.js hands timestamps back as raw text, whose exact spelling depends on the column type.
  // Everything downstream compares and serialises these, so pin them to the ISO form the
  // query already produced rather than relying on Date parsing the raw value.
  return { ...rows[0], opens_at: rows[0].opensAtIso, closes_at: rows[0].closesAtIso };
};

/** The student's most recent attempt, with the graded snapshot stored alongside it. */
const latestAttempt = async (quizId, studentId) => {
  const [rows] = await pool.query(
    "SELECT id, score, answers_json, submitted_at FROM quiz_attempts WHERE quiz_id = ? AND student_id = ? ORDER BY id DESC LIMIT 1",
    [quizId, studentId]
  );
  return rows[0] || null;
};

/**
 * The graded detail is stored on the attempt rather than recomputed on read, so reviewing an
 * old attempt still shows the question as it was answered even after the teacher edits the
 * quiz. Older rows predate that and hold a bare answers map; they degrade to score-only.
 */
const attemptReview = (attempt) => {
  if (!attempt) return null;
  const payload = attempt.answers_json && typeof attempt.answers_json === "object" ? attempt.answers_json : {};
  return {
    attemptId: String(attempt.id),
    score: Number(attempt.score || 0),
    maxScore: Number(payload.maxScore ?? 0),
    submittedAt: attempt.submitted_at || null,
    detail: Array.isArray(payload.detail) ? payload.detail : [],
  };
};

exports.getQuizDetail = async (req, res) => {
  await ensureAcademicSchema();
  const quiz = await loadQuizOr404(req, res);
  if (!quiz) return;

  const questions = await readQuizQuestions(quiz.id);
  const maxScore = questions.reduce((total, q) => total + q.points, 0);
  const availability = quizAvailability(quiz);
  const base = {
    id: String(quiz.id),
    courseId: String(quiz.course_id),
    courseCode: quiz.courseCode,
    title: quiz.title,
    description: quiz.description || "",
    timeLimit: Number(quiz.time_limit_minutes || 20),
    status: quiz.status,
    availability: availability.state,
    opensAt: isoOrNull(quiz.opens_at),
    closesAt: isoOrNull(quiz.closes_at),
    createdByName: quiz.createdByName || undefined,
    maxScore,
  };

  if (canManageQuizzes(req.user)) {
    return res.json({ ...base, questions, canEdit: true });
  }

  // Not open yet, already finished, or still a draft - none of those are takeable, but someone
  // who already sat it keeps access to their own result.
  const attempt = await latestAttempt(quiz.id, req.user.id);
  if (availability.state !== "available" && !attempt) {
    return res.status(403).json({
      message:
        availability.state === "scheduled"
          ? `This quiz opens on ${new Date(availability.opensAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
          : "This quiz isn't open right now",
    });
  }

  res.json({
    ...base,
    questions: questions.map(withoutAnswerKey),
    canEdit: false,
    // What the player counts down from: never more than the window has left.
    secondsAllowed: secondsAllowed(quiz),
    attempt: attemptReview(attempt),
  });
};

exports.getQuizzes = async (req, res) => {
  await seedAcademicData(req.user);

  // quiz_attempts has no unique (quiz_id, student_id) constraint - retakes are allowed - so a
  // flat join across quiz_questions and quiz_attempts fans out (N questions x M attempts) and
  // corrupts COUNT(qq.id). Pre-aggregating each side to one row per quiz before joining avoids
  // that; "mine" additionally pins to a single row via the latest attempt (highest id) so a
  // retake doesn't duplicate the quiz in the list.
  const [rows] = await pool.query(
    `SELECT q.*, c.code AS "courseCode", creator.name AS "createdByName",
      ${isoUtc("q.opens_at", "opensAtIso")}, ${isoUtc("q.closes_at", "closesAtIso")},
      COALESCE(qc."questionCount", 0) AS "questionCount",
      qc."questionTypes",
      ac."averageScore",
      ac."attemptCount",
      mine.score AS "myScore"
     FROM quizzes q
     JOIN courses c ON q.course_id = c.id
     LEFT JOIN users creator ON creator.id = q.created_by
     LEFT JOIN (
       SELECT quiz_id, COUNT(*) AS "questionCount", SUM(points) AS "maxPoints",
              string_agg(DISTINCT question_type, ',') AS "questionTypes"
       FROM quiz_questions
       GROUP BY quiz_id
     ) qc ON qc.quiz_id = q.id
     LEFT JOIN (
       SELECT quiz_id, AVG(score) AS "averageScore", COUNT(*) AS "attemptCount"
       FROM quiz_attempts
       GROUP BY quiz_id
     ) ac ON ac.quiz_id = q.id
     LEFT JOIN quiz_attempts mine ON mine.id = (
       SELECT MAX(id) FROM quiz_attempts latest WHERE latest.quiz_id = q.id AND latest.student_id = ?
     )
     ORDER BY q.created_at DESC`,
    [req.user.id]
  );

  res.json(
    rows.map((row) => {
      const types = String(row.questionTypes || "")
        .split(",")
        .filter(Boolean)
        .map((type) => (type === "true_false" ? "True/False" : "MCQ"));
      return {
        id: String(row.id),
        courseId: String(row.course_id),
        courseCode: row.courseCode,
        title: row.title,
        questionTypes: types.length ? types : ["MCQ"],
        questions: Number(row.questionCount || 0),
        timeLimit: Number(row.time_limit_minutes || 20),
        status: row.myScore !== null && row.myScore !== undefined ? "completed" : row.status === "draft" ? "draft" : "available",
        // The raw state, kept separate from the student-facing `status` above so a teacher can
        // tell a published quiz from a closed one while a student still sees "completed".
        publishStatus: row.status,
        // Where the schedule has actually got to, which is what decides whether it can be
        // taken - "available" here can still mean "not until Friday" in publishStatus terms.
        availability: quizAvailability({ status: row.status, opens_at: row.opensAtIso, closes_at: row.closesAtIso })
          .state,
        opensAt: row.opensAtIso,
        closesAt: row.closesAtIso,
        score: row.myScore === null || row.myScore === undefined ? undefined : Number(row.myScore),
        maxScore: Number(row.maxPoints || 0),
        attemptCount: Number(row.attemptCount || 0),
        averageScore: Math.round(Number(row.averageScore || 0)),
        createdByName: row.createdByName || undefined,
      };
    })
  );
};

/** Shared by create and update: the fields that describe the quiz itself, validated. */
const readQuizMeta = (body) => {
  const title = String(body.title ?? "").trim();
  if (!title) return { error: "A title is required" };

  const timeLimit = Number(body.timeLimit ?? 20);
  if (!Number.isFinite(timeLimit) || timeLimit < 1 || timeLimit > 600) {
    return { error: "The time limit has to be between 1 and 600 minutes" };
  }

  const status = String(body.status ?? "draft").toLowerCase();
  if (!QUIZ_STATUSES.has(status)) return { error: "Unknown quiz status" };

  const opens = readSchedulePoint(body.opensAt, "The opening time");
  if (opens.error) return { error: opens.error };
  const closes = readSchedulePoint(body.closesAt, "The closing time");
  if (closes.error) return { error: closes.error };
  if (opens.value && closes.value && new Date(closes.value) <= new Date(opens.value)) {
    return { error: "The closing time has to be after the opening time" };
  }

  return {
    meta: {
      title,
      description: String(body.description ?? "").trim() || null,
      timeLimit,
      status,
      opensAt: opens.value,
      closesAt: closes.value,
    },
  };
};

exports.createQuiz = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.body.courseId);
  if (!courseId) return res.status(400).json({ message: "Choose a course for this quiz" });

  const { meta, error: metaError } = readQuizMeta(req.body);
  if (metaError) return res.status(400).json({ message: metaError });

  const { questions, error: questionError } = normalizeQuizQuestions(req.body.questions);
  if (questionError) return res.status(400).json({ message: questionError });

  // Publishing a quiz nobody can answer isn't useful; a draft with no questions yet is fine.
  if (meta.status === "available" && !questions?.length) {
    return res.status(400).json({ message: "Add at least one question before publishing this quiz" });
  }

  const [result] = await pool.query(
    `INSERT INTO quizzes (course_id, title, description, time_limit_minutes, status, opens_at, closes_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?::timestamptz, ?::timestamptz, ?)`,
    [courseId, meta.title, meta.description, meta.timeLimit, meta.status, meta.opensAt, meta.closesAt, req.user.id]
  );

  if (questions?.length) await writeQuizQuestions(result.insertId, questions);

  res.status(201).json({ id: String(result.insertId), message: "Quiz created" });
};

exports.updateQuiz = async (req, res) => {
  await ensureAcademicSchema();
  const quiz = await loadQuizOr404(req, res);
  if (!quiz) return;

  const { meta, error: metaError } = readQuizMeta(req.body);
  if (metaError) return res.status(400).json({ message: metaError });

  const { questions, error: questionError } = normalizeQuizQuestions(req.body.questions);
  if (questionError) return res.status(400).json({ message: questionError });

  const courseId = req.body.courseId ? await resolveCourseId(req.body.courseId) : quiz.course_id;
  if (!courseId) return res.status(400).json({ message: "Choose a course for this quiz" });

  // `questions` is null when the caller didn't send the key at all - a status-only change, say.
  const finalCount = questions ? questions.length : Number((await readQuizQuestions(quiz.id)).length);
  if (meta.status === "available" && !finalCount) {
    return res.status(400).json({ message: "Add at least one question before publishing this quiz" });
  }

  await pool.query(
    `UPDATE quizzes SET course_id = ?, title = ?, description = ?, time_limit_minutes = ?, status = ?,
      opens_at = ?::timestamptz, closes_at = ?::timestamptz, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [courseId, meta.title, meta.description, meta.timeLimit, meta.status, meta.opensAt, meta.closesAt, quiz.id]
  );

  if (questions) await writeQuizQuestions(quiz.id, questions);

  res.json({ message: "Quiz updated" });
};

exports.deleteQuiz = async (req, res) => {
  await ensureAcademicSchema();
  const quiz = await loadQuizOr404(req, res);
  if (!quiz) return;

  // quiz_questions and quiz_attempts are both ON DELETE CASCADE, so this takes the attempts
  // with it - which is why the UI asks first and says how many there are.
  await pool.query("DELETE FROM quizzes WHERE id = ?", [quiz.id]);
  res.json({ message: "Quiz deleted" });
};

exports.submitQuizAttempt = async (req, res) => {
  await ensureAcademicSchema();

  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students can submit quiz attempts" });
  }

  // The frontend list briefly renders placeholder demo data (ids like "q1") before the real
  // fetch resolves; a click during that window used to reach this endpoint with a non-numeric
  // id and crash on the INT column with an unhandled MySQL error. Validate first.
  const quizId = Number(req.params.id);
  if (!Number.isInteger(quizId) || quizId <= 0) {
    return res.status(400).json({ message: "Invalid quiz" });
  }

  const [quizRows] = await pool.query(
    `SELECT id, status, time_limit_minutes, ${isoUtc("opens_at", "opens_at")}, ${isoUtc("closes_at", "closes_at")}
     FROM quizzes WHERE id = ?`,
    [quizId]
  );
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  // Checked here and not only in the UI: the window is what actually decides whether an
  // attempt counts, so a request sent early, late, or straight at the API is refused.
  const { state } = quizAvailability(quiz);
  if (state !== "available") {
    return res.status(400).json({
      message:
        state === "scheduled"
          ? "This quiz hasn't opened yet"
          : state === "closed"
            ? "This quiz has closed"
            : "This quiz isn't open for attempts",
    });
  }

  const questions = await readQuizQuestions(quizId);
  if (!questions.length) return res.status(400).json({ message: "This quiz has no questions yet" });

  // Answers arrive keyed by question id. Anything missing or unrecognised simply scores zero
  // rather than failing the submission - a student who runs out of time still gets a result.
  const submitted = req.body.answers && typeof req.body.answers === "object" ? req.body.answers : {};

  const { detail, score, maxScore, correctCount } = gradeQuizAnswers(questions, submitted);

  // The whole graded breakdown is stored on the attempt, not just the raw answers, so a review
  // still reads correctly after the teacher edits or reorders the quiz.
  const [result] = await pool.query(
    "INSERT INTO quiz_attempts (quiz_id, student_id, answers_json, score, submitted_at) VALUES (?, ?, ?::jsonb, ?, CURRENT_TIMESTAMP)",
    [quizId, req.user.id, JSON.stringify({ answers: submitted, detail, maxScore }), score]
  );

  res.status(201).json({
    attemptId: String(result.insertId),
    score,
    maxScore,
    correctCount,
    totalQuestions: detail.length,
    detail,
    message: "Quiz submitted",
  });
};

/**
 * Teachers and admins get every attempt on the quiz; a student gets their own latest one.
 * Both include the answer key - for the student that is only reachable once they have
 * actually submitted, which is what makes it safe to reveal.
 */
exports.getQuizResults = async (req, res) => {
  await ensureAcademicSchema();
  const quiz = await loadQuizOr404(req, res);
  if (!quiz) return;

  if (!canManageQuizzes(req.user)) {
    const attempt = await latestAttempt(quiz.id, req.user.id);
    if (!attempt) return res.status(404).json({ message: "You haven't taken this quiz yet" });
    return res.json({ quizTitle: quiz.title, mine: attemptReview(attempt) });
  }

  const [rows] = await pool.query(
    `SELECT a.id, a.score, a.answers_json, a.submitted_at, u.id AS "studentId", u.name AS "studentName",
      u.email AS "studentEmail"
     FROM quiz_attempts a
     JOIN users u ON u.id = a.student_id
     WHERE a.quiz_id = ?
     ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC`,
    [quiz.id]
  );

  const questions = await readQuizQuestions(quiz.id);
  const maxScore = questions.reduce((total, question) => total + question.points, 0);

  const attempts = rows.map((row) => ({
    ...attemptReview(row),
    studentId: String(row.studentId),
    studentName: row.studentName,
    studentEmail: row.studentEmail,
    // Older attempts stored no maxScore of their own; fall back to the quiz's current total.
    maxScore: Number(row.answers_json?.maxScore ?? maxScore),
  }));

  const scores = attempts.map((attempt) => attempt.score);
  res.json({
    quizTitle: quiz.title,
    maxScore,
    questions,
    attempts,
    stats: {
      attemptCount: attempts.length,
      averageScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0,
      highestScore: scores.length ? Math.max(...scores) : 0,
      lowestScore: scores.length ? Math.min(...scores) : 0,
    },
  });
};

exports.getCalendarEvents = async (req, res) => {
  await seedAcademicData(req.user);
  const [rows] = await pool.query(
    `SELECT e.*, c.code AS "courseCode", creator.name AS "createdByName"
     FROM academic_calendar_events e
     LEFT JOIN courses c ON e.course_id = c.id
     LEFT JOIN users creator ON creator.id = e.created_by
     ORDER BY e.event_date`
  );

  res.json(
    rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      date: dateOnly(row.event_date),
      type: row.event_type,
      course: row.courseCode || undefined,
      courseId: row.course_id ? String(row.course_id) : undefined,
      priority: row.priority || "normal",
      createdByName: row.createdByName || undefined,
    }))
  );
};

exports.createCalendarEvent = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = req.body.courseId ? await resolveCourseId(req.body.courseId) : null;
  const { title, date, type, priority } = req.body;
  if (!title || !date || !type) return res.status(400).json({ message: "title, date, and type are required" });
  const [result] = await pool.query(
    "INSERT INTO academic_calendar_events (title, event_date, event_type, course_id, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [title.trim(), date, type, courseId, priority || "normal", req.user.id]
  );
  res.status(201).json({ id: String(result.insertId), message: "Calendar event created" });
};

exports.updateCalendarEvent = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = req.body.courseId ? await resolveCourseId(req.body.courseId) : null;
  const { title, date, type, priority } = req.body;
  if (!title || !date || !type) return res.status(400).json({ message: "title, date, and type are required" });

  // Deliberately no event_date restriction here - a past event edits the same way an
  // upcoming one does. This is a real UPDATE (not delete+recreate), so the row's id and
  // created_at survive the edit and nothing downstream can mistake it for a new event.
  const [result] = await pool.query(
    "UPDATE academic_calendar_events SET title = ?, event_date = ?, event_type = ?, course_id = ?, priority = ? WHERE id = ?",
    [title.trim(), date, type, courseId, priority || "normal", req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Calendar event not found" });

  res.json({ message: "Calendar event updated" });
};

exports.deleteCalendarEvent = async (req, res) => {
  await ensureAcademicSchema();
  const [result] = await pool.query("DELETE FROM academic_calendar_events WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Calendar event not found" });

  res.json({ message: "Calendar event deleted" });
};

exports.getTranscript = async (req, res) => {
  await seedAcademicData(req.user);
  const studentId = req.user.role === "student" ? req.user.id : req.query.studentId;
  if (!studentId) return res.json([]);

  const [rows] = await pool.query(
    `SELECT tr.*, c.code AS "courseCode", c.title AS "courseTitle"
     FROM transcript_records tr
     LEFT JOIN courses c ON tr.course_id = c.id
     WHERE tr.student_id = ?
     ORDER BY tr.semester, tr.id`,
    [studentId]
  );

  res.json(
    rows.map((row) => ({
      id: String(row.id),
      semester: row.semester,
      courseCode: row.courseCode || "GEN",
      courseTitle: row.courseTitle || "General Education",
      credits: Number(row.credits || 0),
      gradeLetter: row.grade_letter,
      gradePoint: Number(row.grade_point || 0),
    }))
  );
};

exports.getRiskAlerts = async (req, res) => {
  await seedAcademicData(req.user);
  if (req.user.role !== "teacher" && req.user.role !== "admin") return res.json([]);

  const [attendanceRows] = await pool.query(
    `SELECT u.id, u.name, AVG(ce.attendance_percentage) AS attendance, AVG(ce.current_grade) AS grade
     FROM users u
     LEFT JOIN course_enrollments ce ON ce.student_id = u.id
     WHERE u.role = 'student'
     GROUP BY u.id, u.name
     ORDER BY u.name`
  );

  const [missingRows] = await pool.query(
    `SELECT u.id, COUNT(a.id) - COUNT(s.id) AS "missingCount"
     FROM users u
     CROSS JOIN course_assignments a
     LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = u.id
     WHERE u.role = 'student' AND a.deadline < NOW()
     GROUP BY u.id`
  );
  const missingMap = new Map(missingRows.map((row) => [row.id, Number(row.missingCount || 0)]));

  const alerts = [];
  for (const row of attendanceRows) {
    const attendance = Number(row.attendance || 0);
    const grade = Number(row.grade || 0);
    const missingCount = missingMap.get(row.id) || 0;

    if (attendance && attendance < 70) {
      alerts.push({
        id: `attendance-${row.id}`,
        studentName: row.name,
        issue: "Attendance below 70%",
        recommendation: "Contact student and schedule advisor check-in.",
        severity: "urgent",
      });
    } else if (grade && grade < 70) {
      alerts.push({
        id: `grade-${row.id}`,
        studentName: row.name,
        issue: "Grade trend below class average",
        recommendation: "Recommend tutorial session before next quiz.",
        severity: "high",
      });
    } else if (missingCount > 0) {
      alerts.push({
        id: `missing-${row.id}`,
        studentName: row.name,
        issue: `${missingCount} missing assignment${missingCount > 1 ? "s" : ""}`,
        recommendation: "Send reminder and extend support materials.",
        severity: missingCount > 1 ? "high" : "normal",
      });
    }
  }

  res.json(alerts);
};

exports.getContacts = async (req, res) => {
  // Everyone on the platform except yourself and deactivated accounts. This used to return
  // only the opposite role, which meant an admin could never message a teacher and two
  // teachers could never message each other - the directory is the whole point of it.
  const [rows] = await pool.query(
    `SELECT id, name, email, role, avatar
     FROM users
     WHERE id <> ? AND is_active = TRUE
     ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END, name`,
    [req.user.id]
  );
  res.json(
    rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      email: row.email,
      role: row.role,
      avatar: row.avatar || "",
    }))
  );
};

/**
 * One row per person you have exchanged messages with, newest conversation first, carrying
 * the last line and how many of theirs you have not read - everything the conversation list
 * needs without pulling every message down.
 */
exports.getConversations = async (req, res) => {
  await ensureAcademicSchema();

  // DISTINCT ON keeps the highest id per partner, which is that conversation's latest message.
  const [threads] = await pool.query(
    `SELECT DISTINCT ON (t.partner)
       t.partner, t.body, t.created_at AS "lastAt", t.sender_id AS "lastSenderId",
       u.name, u.role, u.avatar
     FROM (
       SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner,
              id, body, created_at, sender_id
       FROM messages
       WHERE sender_id = ? OR receiver_id = ?
     ) t
     JOIN users u ON u.id = t.partner
     ORDER BY t.partner, t.id DESC`,
    [req.user.id, req.user.id, req.user.id]
  );

  const [unread] = await pool.query(
    `SELECT sender_id AS partner, COUNT(*) AS total
     FROM messages
     WHERE receiver_id = ? AND is_read = FALSE
     GROUP BY sender_id`,
    [req.user.id]
  );
  const unreadByPartner = new Map(unread.map((row) => [Number(row.partner), Number(row.total)]));

  res.json(
    threads
      .map((row) => ({
        userId: String(row.partner),
        name: row.name,
        role: row.role,
        avatar: row.avatar || "",
        lastMessage: row.body,
        lastAt: row.lastAt,
        lastFromMe: Number(row.lastSenderId) === Number(req.user.id),
        unreadCount: unreadByPartner.get(Number(row.partner)) || 0,
      }))
      // DISTINCT ON forces ORDER BY partner, so the newest-first ordering is applied here.
      .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
  );
};

/**
 * The full exchange with one person, oldest first, and marks their side as read - opening a
 * conversation is what "reading" it means here, so there is no separate mark-read call.
 */
exports.getThread = async (req, res) => {
  await ensureAcademicSchema();

  const partnerId = Number(req.params.userId);
  if (!Number.isInteger(partnerId) || partnerId <= 0) {
    return res.status(400).json({ message: "Invalid conversation" });
  }

  const [people] = await pool.query("SELECT id, name, email, role, avatar FROM users WHERE id = ?", [partnerId]);
  if (!people.length) return res.status(404).json({ message: "That account no longer exists" });

  const [rows] = await pool.query(
    `SELECT id, sender_id, body, created_at, is_read
     FROM messages
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
     ORDER BY id`,
    [req.user.id, partnerId, partnerId, req.user.id]
  );

  await pool.query("UPDATE messages SET is_read = TRUE WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE", [
    req.user.id,
    partnerId,
  ]);

  const person = people[0];
  res.json({
    person: {
      id: String(person.id),
      name: person.name,
      email: person.email,
      role: person.role,
      avatar: person.avatar || "",
    },
    messages: rows.map((row) => ({
      id: String(row.id),
      body: row.body,
      sentAt: row.created_at,
      fromMe: Number(row.sender_id) === Number(req.user.id),
    })),
  });
};

exports.getMessages = async (req, res) => {
  await ensureAcademicSchema();
  const [rows] = await pool.query(
    `SELECT m.*, sender.name AS "senderName", sender.role AS "senderRole", receiver.name AS "receiverName", receiver.role AS "receiverRole"
     FROM messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN users receiver ON receiver.id = m.receiver_id
     WHERE m.sender_id = ? OR m.receiver_id = ?
     ORDER BY m.created_at DESC`,
    [req.user.id, req.user.id]
  );

  res.json(
    rows.map((row) => {
      const fromMe = Number(row.sender_id) === Number(req.user.id);
      return {
        id: String(row.id),
        person: fromMe ? row.receiverName : row.senderName,
        role: fromMe ? row.receiverRole : row.senderRole,
        subject: row.subject || "Academic message",
        preview: row.body,
        unread: !fromMe && !row.is_read,
        time: timeAgo(row.created_at),
      };
    })
  );
};

exports.createMessage = async (req, res) => {
  await ensureAcademicSchema();
  const { receiverId, subject, body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ message: "Write a message first" });

  // A missing recipient used to fall back to "the first account of the opposite role", and
  // to yourself when there wasn't one - so a mis-wired client silently posted messages into
  // a stranger's inbox. Say what's wrong instead.
  const targetId = Number(receiverId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "Choose who to send this to" });
  }
  if (targetId === Number(req.user.id)) {
    return res.status(400).json({ message: "You can't message yourself" });
  }

  const [recipients] = await pool.query("SELECT id FROM users WHERE id = ? AND is_active = TRUE", [targetId]);
  if (!recipients.length) return res.status(404).json({ message: "That account is not available" });

  const [result] = await pool.query(
    "INSERT INTO messages (sender_id, receiver_id, subject, body) VALUES (?, ?, ?, ?)",
    [req.user.id, targetId, subject || "Academic message", body.trim()]
  );
  res.status(201).json({ id: String(result.insertId), message: "Message sent" });
};

exports.markMessageRead = async (req, res) => {
  await ensureAcademicSchema();
  await pool.query("UPDATE messages SET is_read = TRUE WHERE id = ? AND receiver_id = ?", [req.params.id, req.user.id]);
  res.json({ message: "Message marked as read" });
};

exports.createAttendanceSession = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = req.body.courseId ? await resolveCourseId(req.body.courseId) : null;
  const windowMinutes = Math.min(60, Math.max(1, Number(req.body.windowMinutes || 10)));
  const code = `RUPPER-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const [result] = await pool.query(
    `INSERT INTO attendance_sessions (course_id, code, starts_at, expires_at, created_by)
     VALUES (?, ?, NOW(), NOW() + (?::int * INTERVAL '1 minute'), ?)`,
    [courseId, code, windowMinutes, req.user.id]
  );

  res.status(201).json({ id: String(result.insertId), code, windowMinutes, expiresAt: new Date(Date.now() + windowMinutes * 60000).toISOString() });
};

exports.checkInAttendanceSession = async (req, res) => {
  await ensureAcademicSchema();
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: "code is required" });

  const [sessions] = await pool.query("SELECT * FROM attendance_sessions WHERE code = ? AND expires_at >= NOW()", [code.trim()]);
  const session = sessions[0];
  if (!session) return res.status(404).json({ message: "Attendance code is invalid or expired" });
  if (req.user.role !== "student") return res.status(400).json({ message: "Only students can check in" });

  await pool.query(
    `INSERT INTO attendance (student_id, attendance_date, status, created_by)
     VALUES (?, CURRENT_DATE, 'present', ?)
     ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = 'present', created_by = EXCLUDED.created_by`,
    [req.user.id, session.created_by]
  );

  res.json({ message: "Attendance recorded" });
};

// Exported for test/quizGrading.test.mjs - the marking rules and the question validation are
// the two pieces of the quiz feature worth pinning down directly, and both are pure.
exports.__testing = { gradeQuizAnswers, normalizeQuizQuestions, quizAvailability, secondsAllowed };
