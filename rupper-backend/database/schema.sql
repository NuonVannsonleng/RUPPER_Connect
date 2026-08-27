-- RUPPER Connect - PostgreSQL schema (Supabase)
--
-- Paste this whole file into the Supabase SQL editor and run it once, or run it against a
-- local Postgres with:  psql "$DATABASE_URL" -f database/schema.sql
--
-- Every statement is idempotent, so re-running it is safe.
--
-- Notes on the translation from the old MySQL schema:
--   * AUTO_INCREMENT           -> GENERATED ALWAYS AS IDENTITY
--   * ENUM(...)                -> TEXT with a CHECK constraint (far easier to extend later)
--   * TINYINT(1) is_active     -> BOOLEAN
--   * LONGTEXT / LONGBLOB      -> TEXT / BYTEA
--   * JSON                     -> JSONB
--   * ON UPDATE CURRENT_TIMESTAMP has no Postgres equivalent, so it is done with the
--     set_updated_at() trigger below.

-- ---------------------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  phone VARCHAR(30),
  avatar TEXT,
  student_id VARCHAR(50),
  major VARCHAR(100),
  year VARCHAR(50),
  department VARCHAR(100),
  office VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_changed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_attendance UNIQUE (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(120) NOT NULL,
  assignment VARCHAR(120) NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  max_score DECIMAL(5,2) DEFAULT 100,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_grade UNIQUE (student_id, subject, assignment)
);

DROP TRIGGER IF EXISTS grades_set_updated_at ON grades;
CREATE TRIGGER grades_set_updated_at BEFORE UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  teacher VARCHAR(120),
  room VARCHAR(80),
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_visibility TEXT DEFAULT 'both' CHECK (role_visibility IN ('student','teacher','both')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------------------
-- Academic module
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
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
);

DROP TRIGGER IF EXISTS courses_set_updated_at ON courses;
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS course_enrollments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress DECIMAL(5,2) DEFAULT 0,
  attendance_percentage DECIMAL(5,2) DEFAULT 0,
  current_grade DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_course_student UNIQUE (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS course_materials (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  material_type VARCHAR(20) NOT NULL DEFAULT 'file',
  file_url TEXT,
  file_name VARCHAR(255),
  file_mime VARCHAR(150),
  file_data BYTEA,
  file_size INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_assignments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  deadline TIMESTAMP NOT NULL,
  max_score DECIMAL(6,2) DEFAULT 100,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS course_assignments_set_updated_at ON course_assignments;
CREATE TRIGGER course_assignments_set_updated_at BEFORE UPDATE ON course_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name VARCHAR(255),
  file_mime VARCHAR(150),
  file_data BYTEA,
  file_size INTEGER,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','late','missing','graded')),
  score DECIMAL(6,2),
  feedback TEXT,
  graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  graded_at TIMESTAMP NULL,
  CONSTRAINT unique_assignment_submission UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  time_limit_minutes INTEGER DEFAULT 20,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','available','closed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS quizzes_set_updated_at ON quizzes;
CREATE TRIGGER quizzes_set_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq','true_false')),
  options_json JSONB,
  correct_answer VARCHAR(255) NOT NULL,
  points DECIMAL(5,2) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers_json JSONB,
  score DECIMAL(6,2),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS academic_calendar_events (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('exam','assignment','holiday','event')),
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transcript_records (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  semester VARCHAR(80) NOT NULL,
  credits INTEGER NOT NULL,
  grade_letter VARCHAR(5) NOT NULL,
  grade_point DECIMAL(3,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(180),
  -- Nullable: a photo or voice note sent without a caption has no text.
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  -- Chat attachments: one per message ('image', 'file', 'voice', 'sticker').
  attachment_kind VARCHAR(12),
  file_name VARCHAR(255),
  file_mime VARCHAR(150),
  file_data BYTEA,
  file_size INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_announcement_read UNIQUE (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS notification_reads (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key VARCHAR(120) NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_notification_read UNIQUE (user_id, notification_key)
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  starts_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------------------
-- Auth support tables (also created lazily at boot, kept here so a fresh database is complete)
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  requested_ip VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reset_user_active ON password_reset_tokens (user_id, used_at);

CREATE TABLE IF NOT EXISTS email_change_requests (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email VARCHAR(120) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  requested_ip VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_change_user_active ON email_change_requests (user_id, used_at);

-- ---------------------------------------------------------------------------------------
-- Indexes
--
-- MySQL creates an index for every foreign key automatically. Postgres does not, so these
-- have to be declared: without them the dashboard's joins sequential-scan whole tables.
-- Columns that lead a UNIQUE constraint (attendance.student_id, grades.student_id,
-- assignment_submissions.assignment_id, ...) are already covered by that constraint's index.
-- ---------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON course_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_materials_course ON course_materials (course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON course_assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON course_assignments (deadline);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_student ON quiz_attempts (quiz_id, student_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON academic_calendar_events (event_date);
CREATE INDEX IF NOT EXISTS idx_transcripts_student ON transcript_records (student_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON courses (lecturer_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads (user_id);
