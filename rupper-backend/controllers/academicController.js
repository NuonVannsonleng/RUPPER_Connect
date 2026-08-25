const pool = require("../config/db");
const { withAdvisoryLock, isDuplicateKeyError } = require("../db");

// Arbitrary but fixed keys for pg_advisory_xact_lock - the Postgres replacement for the
// MySQL named locks this module used to take (GET_LOCK('rupper_academic_schema', ...)).
const ACADEMIC_SCHEMA_LOCK = 811001;
const ACADEMIC_SEED_LOCK = 811002;

let schemaReady = false;

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

  // Parallel first requests (courses, assignments, quizzes, calendar all fire together on
  // page load) would otherwise race here - the ALTER TABLEs below aren't safe to run
  // concurrently the way CREATE TABLE IF NOT EXISTS is. A Postgres advisory lock serialises
  // them; see withAdvisoryLock in db.js for why it needs its own connection.
  await withAdvisoryLock(ACADEMIC_SCHEMA_LOCK, ensureAcademicSchemaLocked);
};

const ensureAcademicSchemaLocked = async () => {
  if (schemaReady) return;

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
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }

  schemaReady = true;
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

const seedAcademicData = async (user) => {
  await ensureAcademicSchema();

  // Several endpoints call this on first load (courses, assignments, quizzes, calendar, ...),
  // and the frontend fires those requests in parallel. Without a lock, concurrent requests
  // all see an empty table at once and each inserts its own copy of the seed rows, producing
  // duplicates. The advisory lock serialises the check-then-insert so only one request seeds.
  await withAdvisoryLock(ACADEMIC_SEED_LOCK, () => seedAcademicDataLocked(user));
};

const seedAcademicDataLocked = async (user) => {
  const [courseCountRows] = await pool.query("SELECT COUNT(*) AS total FROM courses");
  if (Number(courseCountRows[0].total) === 0) {
    const lecturerId = user.role === "teacher" ? user.id : null;
    const courses = [
      ["CS301", "Database Systems", "Faculty of Engineering", "Information Technology Engineering", lecturerId, 3, "Year 2 - Semester 2", "Lab 204", "Monday 08:00 - 09:30", "Relational design, SQL, transactions, indexing, and database-backed application development."],
      ["SE220", "Software Engineering", "Faculty of Engineering", "Data Science Engineering", lecturerId, 3, "Year 2 - Semester 2", "R-305", "Tuesday 10:00 - 11:30", "Requirements, agile delivery, testing, software design, and team project workflows."],
      ["AI210", "Applied AI for Learning", "Faculty of Science", "Computer Science", lecturerId, 3, "Year 2 - Semester 2", "Lab 101", "Wednesday 13:00 - 14:30", "Practical AI concepts, model evaluation, responsible AI, and classroom-focused applications."],
    ];

    for (const course of courses) {
      await pool.query(
        `INSERT INTO courses
          (code, title, faculty, department, lecturer_id, credits, semester, room, schedule_label, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title`,
        course
      );
    }
  }

  const [courses] = await pool.query("SELECT id, code FROM courses ORDER BY id");
  const byCode = Object.fromEntries(courses.map((course) => [course.code, course.id]));

  const [materialCount] = await pool.query("SELECT COUNT(*) AS total FROM course_materials");
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
      await pool.query(
        "INSERT INTO course_materials (course_id, title, material_type, created_by) VALUES (?, ?, ?, ?)",
        [courseId, title, type, user.id]
      );
    }
  }

  const [assignmentCount] = await pool.query("SELECT COUNT(*) AS total FROM course_assignments");
  if (Number(assignmentCount[0].total) === 0 && courses.length) {
    const assignments = [
      [byCode.CS301, "Library Database Design", "Design a normalized schema for a small library system.", "2026-07-18 23:59:00", 100],
      [byCode.CS301, "Transaction Isolation Report", "Explain transaction isolation levels with examples.", "2026-07-24 23:59:00", 50],
      [byCode.SE220, "Project Milestone 2", "Submit sprint demo notes and test plan.", "2026-07-20 23:59:00", 100],
      [byCode.AI210, "Dataset Reflection", "Reflect on dataset quality and responsible AI risks.", "2026-07-13 23:59:00", 40],
    ].filter(([courseId]) => courseId);

    for (const row of assignments) {
      await pool.query(
        "INSERT INTO course_assignments (course_id, title, description, deadline, max_score, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [...row, user.id]
      );
    }
  }

  const [quizCount] = await pool.query("SELECT COUNT(*) AS total FROM quizzes");
  if (Number(quizCount[0].total) === 0 && courses.length) {
    const quizzes = [
      [byCode.CS301, "SQL Fundamentals", "MCQ and true/false SQL check.", 25, "available"],
      [byCode.SE220, "Testing and QA", "Software testing knowledge check.", 20, "available"],
      [byCode.AI210, "Responsible AI Check", "Responsible AI concepts.", 15, "draft"],
    ].filter(([courseId]) => courseId);

    for (const [courseId, title, description, minutes, status] of quizzes) {
      const [result] = await pool.query(
        "INSERT INTO quizzes (course_id, title, description, time_limit_minutes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [courseId, title, description, minutes, status, user.id]
      );
      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, correct_answer, points)
         VALUES (?, ?, 'mcq', '["A","B","C","D"]'::jsonb, 'A', 1),
                (?, ?, 'true_false', '["True","False"]'::jsonb, 'True', 1)`,
        [result.insertId, `${title} sample MCQ`, result.insertId, `${title} sample true or false`]
      );
    }
  }

  const [calendarCount] = await pool.query("SELECT COUNT(*) AS total FROM academic_calendar_events");
  if (Number(calendarCount[0].total) === 0) {
    const events = [
      ["Database Midterm Exam", "2026-07-22", "exam", byCode.CS301, "urgent"],
      ["Project Milestone 2 Due", "2026-07-20", "assignment", byCode.SE220, "high"],
      ["University Research Forum", "2026-07-27", "event", null, "normal"],
      ["Constitution Day Holiday", "2026-09-24", "holiday", null, "normal"],
    ];
    for (const event of events) {
      await pool.query(
        "INSERT INTO academic_calendar_events (title, event_date, event_type, course_id, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [...event, user.id]
      );
    }
  }

  if (user.role === "student") {
    for (const course of courses) {
      await pool.query(
        `INSERT INTO course_enrollments (course_id, student_id, progress, attendance_percentage, current_grade)
         VALUES (?, ?, 72, 94, 86)
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [course.id, user.id]
      );
    }

    const [transcriptCount] = await pool.query("SELECT COUNT(*) AS total FROM transcript_records WHERE student_id = ?", [user.id]);
    if (Number(transcriptCount[0].total) === 0) {
      const records = [
        [null, "Year 1 - Semester 1", 3, "B+", 3.3],
        [null, "Year 1 - Semester 1", 3, "A-", 3.7],
        [byCode.CS301 || null, "Year 2 - Semester 2", 3, "A-", 3.7],
        [byCode.SE220 || null, "Year 2 - Semester 2", 3, "B+", 3.3],
      ];
      for (const row of records) {
        await pool.query(
          "INSERT INTO transcript_records (student_id, course_id, semester, credits, grade_letter, grade_point) VALUES (?, ?, ?, ?, ?, ?)",
          [user.id, ...row]
        );
      }
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

exports.getQuizzes = async (req, res) => {
  await seedAcademicData(req.user);

  // quiz_attempts has no unique (quiz_id, student_id) constraint - retakes are allowed - so a
  // flat join across quiz_questions and quiz_attempts fans out (N questions x M attempts) and
  // corrupts COUNT(qq.id). Pre-aggregating each side to one row per quiz before joining avoids
  // that; "mine" additionally pins to a single row via the latest attempt (highest id) so a
  // retake doesn't duplicate the quiz in the list.
  const [rows] = await pool.query(
    `SELECT q.*, c.code AS "courseCode", creator.name AS "createdByName",
      COALESCE(qc."questionCount", 0) AS "questionCount",
      qc."questionTypes",
      ac."averageScore",
      mine.score AS "myScore"
     FROM quizzes q
     JOIN courses c ON q.course_id = c.id
     LEFT JOIN users creator ON creator.id = q.created_by
     LEFT JOIN (
       SELECT quiz_id, COUNT(*) AS "questionCount", string_agg(DISTINCT question_type, ',') AS "questionTypes"
       FROM quiz_questions
       GROUP BY quiz_id
     ) qc ON qc.quiz_id = q.id
     LEFT JOIN (
       SELECT quiz_id, AVG(score) AS "averageScore"
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
        score: row.myScore === null || row.myScore === undefined ? undefined : Number(row.myScore),
        averageScore: Math.round(Number(row.averageScore || 0)),
        createdByName: row.createdByName || undefined,
      };
    })
  );
};

exports.createQuiz = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.body.courseId);
  const { title, description, timeLimit, status } = req.body;
  if (!courseId || !title) return res.status(400).json({ message: "courseId and title are required" });

  const [result] = await pool.query(
    "INSERT INTO quizzes (course_id, title, description, time_limit_minutes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [courseId, title.trim(), description || null, timeLimit || 20, status || "available", req.user.id]
  );
  await pool.query(
    `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, correct_answer, points)
     VALUES (?, 'Sample MCQ question', 'mcq', '["A","B","C","D"]'::jsonb, 'A', 1),
            (?, 'Sample true or false question', 'true_false', '["True","False"]'::jsonb, 'True', 1)`,
    [result.insertId, result.insertId]
  );
  res.status(201).json({ id: String(result.insertId), message: "Quiz created" });
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

  const [quizRows] = await pool.query("SELECT id, status FROM quizzes WHERE id = ?", [quizId]);
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });
  if (quiz.status !== "available") {
    return res.status(400).json({ message: "This quiz isn't open for attempts" });
  }

  const [questions] = await pool.query("SELECT COUNT(*) AS total FROM quiz_questions WHERE quiz_id = ?", [quizId]);
  const score = Math.max(1, Number(questions[0]?.total || 1));
  await pool.query(
    "INSERT INTO quiz_attempts (quiz_id, student_id, answers_json, score, submitted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [quizId, req.user.id, JSON.stringify(req.body.answers || {}), score]
  );
  res.status(201).json({ score, message: "Quiz submitted" });
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
  // Framed around "who am I not" rather than "am I a teacher": an admin substituting for a
  // teacher isn't literally role "teacher", but they still need student contacts, not other
  // teachers'. Only a student should ever see the teacher list.
  const oppositeRole = req.user.role === "student" ? "teacher" : "student";
  const [rows] = await pool.query(
    "SELECT id, name, email, role FROM users WHERE role = ? AND id <> ? ORDER BY name",
    [oppositeRole, req.user.id]
  );
  res.json(rows.map((row) => ({ id: String(row.id), name: row.name, email: row.email, role: row.role })));
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
  if (!body) return res.status(400).json({ message: "body is required" });

  let nextReceiverId = receiverId;
  if (!nextReceiverId) {
    const oppositeRole = req.user.role === "student" ? "teacher" : "student";
    const [users] = await pool.query("SELECT id FROM users WHERE role = ? AND id <> ? ORDER BY id LIMIT 1", [oppositeRole, req.user.id]);
    nextReceiverId = users[0]?.id || req.user.id;
  }

  const [result] = await pool.query(
    "INSERT INTO messages (sender_id, receiver_id, subject, body) VALUES (?, ?, ?, ?)",
    [req.user.id, nextReceiverId, subject || "Academic message", body.trim()]
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
