const pool = require("../config/db");

let schemaReady = false;

const materialTypeToDb = (value = "file") => {
  const normalized = String(value).toLowerCase();
  if (normalized === "pdf") return "pdf";
  if (normalized === "slides") return "slides";
  if (normalized === "video") return "video";
  if (normalized === "link") return "link";
  return "file";
};

const materialTypeToUi = (value = "file") => {
  const labels = { pdf: "PDF", slides: "Slides", video: "Video", link: "Link", file: "PDF" };
  return labels[value] || "PDF";
};

const dateOnly = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
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

  const statements = [
    `CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      title VARCHAR(160) NOT NULL,
      faculty VARCHAR(120),
      department VARCHAR(120),
      lecturer_id INT,
      credits INT DEFAULT 3,
      semester VARCHAR(80),
      room VARCHAR(80),
      schedule_label VARCHAR(120),
      description TEXT,
      status ENUM('active','completed','archived') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS course_enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      student_id INT NOT NULL,
      progress DECIMAL(5,2) DEFAULT 0,
      attendance_percentage DECIMAL(5,2) DEFAULT 0,
      current_grade DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_course_student (course_id, student_id),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS course_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      title VARCHAR(180) NOT NULL,
      material_type ENUM('pdf','slides','video','link','file') DEFAULT 'file',
      file_url TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS course_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      title VARCHAR(180) NOT NULL,
      description TEXT,
      deadline DATETIME NOT NULL,
      max_score DECIMAL(6,2) DEFAULT 100,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      student_id INT NOT NULL,
      file_url TEXT,
      status ENUM('submitted','late','missing','graded') DEFAULT 'submitted',
      score DECIMAL(6,2),
      feedback TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      graded_at TIMESTAMP NULL,
      UNIQUE KEY unique_assignment_submission (assignment_id, student_id),
      FOREIGN KEY (assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      title VARCHAR(180) NOT NULL,
      description TEXT,
      time_limit_minutes INT DEFAULT 20,
      status ENUM('draft','available','closed') DEFAULT 'draft',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS quiz_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quiz_id INT NOT NULL,
      question_text TEXT NOT NULL,
      question_type ENUM('mcq','true_false') NOT NULL,
      options_json JSON,
      correct_answer VARCHAR(255) NOT NULL,
      points DECIMAL(5,2) DEFAULT 1,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quiz_id INT NOT NULL,
      student_id INT NOT NULL,
      answers_json JSON,
      score DECIMAL(6,2),
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      submitted_at TIMESTAMP NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS academic_calendar_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      event_date DATE NOT NULL,
      event_type ENUM('exam','assignment','holiday','event') NOT NULL,
      course_id INT,
      priority ENUM('normal','high','urgent') DEFAULT 'normal',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS transcript_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      course_id INT,
      semester VARCHAR(80) NOT NULL,
      credits INT NOT NULL,
      grade_letter VARCHAR(5) NOT NULL,
      grade_point DECIMAL(3,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      subject VARCHAR(180),
      body TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS announcement_reads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      announcement_id INT NOT NULL,
      user_id INT NOT NULL,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_announcement_read (announcement_id, user_id),
      FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT,
      code VARCHAR(80) NOT NULL UNIQUE,
      starts_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
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
         ON DUPLICATE KEY UPDATE title = VALUES(title)`,
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
         VALUES (?, ?, 'mcq', JSON_ARRAY('A', 'B', 'C', 'D'), 'A', 1),
                (?, ?, 'true_false', JSON_ARRAY('True', 'False'), 'True', 1)`,
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
         ON DUPLICATE KEY UPDATE student_id = VALUES(student_id)`,
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
    `SELECT c.*, u.name AS lecturerName, u.email AS lecturerEmail
     FROM courses c
     LEFT JOIN users u ON c.lecturer_id = u.id
     ORDER BY c.code`
  );
  const ids = courses.map((course) => course.id);
  if (!ids.length) return res.json([]);

  const [materials] = await pool.query("SELECT * FROM course_materials WHERE course_id IN (?) ORDER BY created_at DESC", [ids]);
  const [assignments] = await pool.query("SELECT * FROM course_assignments WHERE course_id IN (?) ORDER BY deadline", [ids]);
  const [quizzes] = await pool.query("SELECT * FROM quizzes WHERE course_id IN (?) ORDER BY created_at DESC", [ids]);
  const [metrics] = await pool.query(
    `SELECT course_id, AVG(progress) AS progress, AVG(attendance_percentage) AS attendance, AVG(current_grade) AS grade
     FROM course_enrollments WHERE course_id IN (?) GROUP BY course_id`,
    [ids]
  );

  const materialMap = new Map();
  materials.forEach((item) => {
    const list = materialMap.get(item.course_id) || [];
    list.push({ id: String(item.id), title: item.title, type: materialTypeToUi(item.material_type), uploadedAt: shortDate(item.created_at) });
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

  const [result] = await pool.query(
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

  res.status(201).json({ id: String(result.insertId), message: "Course created" });
};

exports.createMaterial = async (req, res) => {
  await ensureAcademicSchema();
  const courseId = await resolveCourseId(req.params.courseId);
  const { title, type, fileUrl } = req.body;
  if (!courseId || !title) return res.status(400).json({ message: "courseId and title are required" });

  const [result] = await pool.query(
    "INSERT INTO course_materials (course_id, title, material_type, file_url, created_by) VALUES (?, ?, ?, ?, ?)",
    [courseId, title.trim(), materialTypeToDb(type), fileUrl || null, req.user.id]
  );

  res.status(201).json({ id: String(result.insertId), message: "Material uploaded" });
};

exports.getAssignments = async (req, res) => {
  await seedAcademicData(req.user);

  const [rows] = await pool.query(
    `SELECT a.*, c.code AS courseCode,
      COUNT(s.id) AS submissionCount,
      mine.id AS submissionId,
      mine.status AS submissionStatus,
      mine.score,
      mine.feedback,
      mine.submitted_at AS submittedAt
     FROM course_assignments a
     JOIN courses c ON a.course_id = c.id
     LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
     LEFT JOIN assignment_submissions mine ON mine.assignment_id = a.id AND mine.student_id = ?
     GROUP BY a.id, c.code, mine.id, mine.status, mine.score, mine.feedback, mine.submitted_at
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
  const { fileUrl } = req.body;
  await pool.query(
    `INSERT INTO assignment_submissions (assignment_id, student_id, file_url, status)
     VALUES (?, ?, ?, 'submitted')
     ON DUPLICATE KEY UPDATE file_url = VALUES(file_url), status = 'submitted', submitted_at = CURRENT_TIMESTAMP`,
    [req.params.id, req.user.id, fileUrl || null]
  );
  res.status(201).json({ message: "Assignment submitted" });
};

exports.gradeSubmission = async (req, res) => {
  await ensureAcademicSchema();
  const { score, feedback } = req.body;
  if (score === undefined) return res.status(400).json({ message: "score is required" });
  const [result] = await pool.query(
    "UPDATE assignment_submissions SET score = ?, feedback = ?, status = 'graded', graded_at = CURRENT_TIMESTAMP WHERE id = ?",
    [score, feedback || null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Submission not found" });
  res.json({ message: "Submission graded" });
};

exports.getQuizzes = async (req, res) => {
  await seedAcademicData(req.user);

  const [rows] = await pool.query(
    `SELECT q.*, c.code AS courseCode,
      COUNT(qq.id) AS questionCount,
      GROUP_CONCAT(DISTINCT qq.question_type) AS questionTypes,
      AVG(qa.score) AS averageScore,
      mine.score AS myScore
     FROM quizzes q
     JOIN courses c ON q.course_id = c.id
     LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
     LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
     LEFT JOIN quiz_attempts mine ON mine.quiz_id = q.id AND mine.student_id = ?
     GROUP BY q.id, c.code, mine.score
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
     VALUES (?, 'Sample MCQ question', 'mcq', JSON_ARRAY('A', 'B', 'C', 'D'), 'A', 1),
            (?, 'Sample true or false question', 'true_false', JSON_ARRAY('True', 'False'), 'True', 1)`,
    [result.insertId, result.insertId]
  );
  res.status(201).json({ id: String(result.insertId), message: "Quiz created" });
};

exports.submitQuizAttempt = async (req, res) => {
  await ensureAcademicSchema();
  const [questions] = await pool.query("SELECT COUNT(*) AS total FROM quiz_questions WHERE quiz_id = ?", [req.params.id]);
  const score = Math.max(1, Number(questions[0]?.total || 1));
  await pool.query(
    "INSERT INTO quiz_attempts (quiz_id, student_id, answers_json, score, submitted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [req.params.id, req.user.id, JSON.stringify(req.body.answers || {}), score]
  );
  res.status(201).json({ score, message: "Quiz submitted" });
};

exports.getCalendarEvents = async (req, res) => {
  await seedAcademicData(req.user);
  const [rows] = await pool.query(
    `SELECT e.*, c.code AS courseCode
     FROM academic_calendar_events e
     LEFT JOIN courses c ON e.course_id = c.id
     ORDER BY e.event_date`
  );

  res.json(
    rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      date: dateOnly(row.event_date),
      type: row.event_type,
      course: row.courseCode || undefined,
      priority: row.priority || "normal",
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

exports.getTranscript = async (req, res) => {
  await seedAcademicData(req.user);
  const studentId = req.user.role === "student" ? req.user.id : req.query.studentId;
  if (!studentId) return res.json([]);

  const [rows] = await pool.query(
    `SELECT tr.*, c.code AS courseCode, c.title AS courseTitle
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
    `SELECT u.id, COUNT(a.id) - COUNT(s.id) AS missingCount
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

exports.getMessages = async (req, res) => {
  await ensureAcademicSchema();
  const [rows] = await pool.query(
    `SELECT m.*, sender.name AS senderName, sender.role AS senderRole, receiver.name AS receiverName, receiver.role AS receiverRole
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
    const oppositeRole = req.user.role === "teacher" ? "student" : "teacher";
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
     VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
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
     VALUES (?, CURDATE(), 'present', ?)
     ON DUPLICATE KEY UPDATE status = 'present', created_by = VALUES(created_by)`,
    [req.user.id, session.created_by]
  );

  res.json({ message: "Attendance recorded" });
};
