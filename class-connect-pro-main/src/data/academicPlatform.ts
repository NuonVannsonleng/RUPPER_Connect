export type CourseStatus = "active" | "completed" | "at-risk";
export type AssignmentStatus = "submitted" | "pending" | "missing" | "graded" | "late";
export type CalendarEventType = "exam" | "assignment" | "holiday" | "event";
export type PriorityLevel = "normal" | "high" | "urgent";

export interface AcademicMaterial {
  id: string;
  title: string;
  type: "PDF" | "Slides" | "Video" | "Link";
  uploadedAt: string;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  downloadUrl?: string;
  createdByName?: string;
}

export interface AcademicAssignment {
  id: string;
  courseId: string;
  courseCode: string;
  title: string;
  deadline: string;
  maxScore: number;
  status: AssignmentStatus;
  submittedAt?: string;
  score?: number;
  feedback?: string;
  submissionCount: number;
  submissionId?: string;
  fileName?: string;
  downloadUrl?: string;
  createdByName?: string;
}

export interface AcademicQuiz {
  id: string;
  courseId: string;
  courseCode: string;
  title: string;
  questionTypes: Array<"MCQ" | "True/False">;
  questions: number;
  timeLimit: number;
  status: "available" | "completed" | "draft";
  score?: number;
  averageScore: number;
  createdByName?: string;
}

export interface AcademicCourse {
  id: string;
  code: string;
  title: string;
  faculty: string;
  department: string;
  lecturer: string;
  lecturerEmail: string;
  credits: number;
  semester: string;
  room: string;
  schedule: string;
  progress: number;
  attendance: number;
  grade: number;
  status: CourseStatus;
  description: string;
  materials: AcademicMaterial[];
  assignments: AcademicAssignment[];
  quizzes: AcademicQuiz[];
  discussionCount: number;
}

export interface TranscriptRecord {
  id: string;
  semester: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  gradeLetter: string;
  gradePoint: number;
}

export interface StudentAlert {
  id: string;
  studentName: string;
  issue: string;
  recommendation: string;
  severity: PriorityLevel;
}

export interface AcademicCalendarEvent {
  id: string;
  title: string;
  date: string;
  type: CalendarEventType;
  course?: string;
  courseId?: string;
  priority: PriorityLevel;
  createdByName?: string;
}

export interface MessageThread {
  id: string;
  person: string;
  role: "teacher" | "student";
  subject: string;
  preview: string;
  unread: boolean;
  time: string;
}

export const studentAcademicProfile = {
  name: "Vannsonleng Nuon",
  studentId: "RUPP-ITE-2026-014",
  faculty: "Faculty of Engineering",
  major: "Information Technology Engineering",
  currentSemester: "Year 2 - Semester 2",
  gpa: 3.62,
  completedCredits: 72,
  attendancePercentage: 94,
};

export const academicCourses: AcademicCourse[] = [
  {
    id: "cs301",
    code: "CS301",
    title: "Database Systems",
    faculty: "Faculty of Engineering",
    department: "Information Technology Engineering",
    lecturer: "Dr. Sok Dara",
    lecturerEmail: "sok.dara@rupp.edu.kh",
    credits: 3,
    semester: "Year 2 - Semester 2",
    room: "Lab 204",
    schedule: "Monday 08:00 - 09:30",
    progress: 72,
    attendance: 96,
    grade: 88,
    status: "active",
    description: "Relational design, SQL, transactions, indexing, and database-backed application development.",
    materials: [
      { id: "m1", title: "ER Modeling Guide", type: "PDF", uploadedAt: "Jul 01" },
      { id: "m2", title: "SQL Joins Lab", type: "Slides", uploadedAt: "Jul 04" },
    ],
    assignments: [
      {
        id: "a1",
        courseId: "cs301",
        courseCode: "CS301",
        title: "Library Database Design",
        deadline: "2026-07-18",
        maxScore: 100,
        status: "submitted",
        submittedAt: "2026-07-08",
        score: 92,
        feedback: "Strong schema design. Add more indexes for search-heavy tables.",
        submissionCount: 28,
      },
      {
        id: "a2",
        courseId: "cs301",
        courseCode: "CS301",
        title: "Transaction Isolation Report",
        deadline: "2026-07-24",
        maxScore: 50,
        status: "pending",
        submissionCount: 16,
      },
    ],
    quizzes: [
      {
        id: "q1",
        courseId: "cs301",
        courseCode: "CS301",
        title: "SQL Fundamentals",
        questionTypes: ["MCQ", "True/False"],
        questions: 20,
        timeLimit: 25,
        status: "completed",
        score: 18,
        averageScore: 15,
      },
    ],
    discussionCount: 14,
  },
  {
    id: "se220",
    code: "SE220",
    title: "Software Engineering",
    faculty: "Faculty of Engineering",
    department: "Data Science Engineering",
    lecturer: "Ms. Chan Sreypov",
    lecturerEmail: "sreypov.chan@rupp.edu.kh",
    credits: 3,
    semester: "Year 2 - Semester 2",
    room: "R-305",
    schedule: "Tuesday 10:00 - 11:30",
    progress: 64,
    attendance: 91,
    grade: 83,
    status: "active",
    description: "Requirements, agile delivery, testing, software design, and team project workflows.",
    materials: [
      { id: "m3", title: "Agile Sprint Template", type: "Link", uploadedAt: "Jun 28" },
      { id: "m4", title: "Testing Strategy Notes", type: "PDF", uploadedAt: "Jul 06" },
    ],
    assignments: [
      {
        id: "a3",
        courseId: "se220",
        courseCode: "SE220",
        title: "Project Milestone 2",
        deadline: "2026-07-20",
        maxScore: 100,
        status: "pending",
        submissionCount: 21,
      },
    ],
    quizzes: [
      {
        id: "q2",
        courseId: "se220",
        courseCode: "SE220",
        title: "Testing and QA",
        questionTypes: ["MCQ"],
        questions: 15,
        timeLimit: 20,
        status: "available",
        averageScore: 12,
      },
    ],
    discussionCount: 9,
  },
  {
    id: "ai210",
    code: "AI210",
    title: "Applied AI for Learning",
    faculty: "Faculty of Science",
    department: "Computer Science",
    lecturer: "Prof. Lim Vicheka",
    lecturerEmail: "vicheka.lim@rupp.edu.kh",
    credits: 3,
    semester: "Year 2 - Semester 2",
    room: "Lab 101",
    schedule: "Wednesday 13:00 - 14:30",
    progress: 58,
    attendance: 86,
    grade: 79,
    status: "active",
    description: "Practical AI concepts, model evaluation, responsible AI, and classroom-focused applications.",
    materials: [
      { id: "m5", title: "Model Evaluation Slides", type: "Slides", uploadedAt: "Jul 03" },
      { id: "m6", title: "Responsible AI Case Study", type: "PDF", uploadedAt: "Jul 08" },
    ],
    assignments: [
      {
        id: "a4",
        courseId: "ai210",
        courseCode: "AI210",
        title: "Dataset Reflection",
        deadline: "2026-07-13",
        maxScore: 40,
        status: "missing",
        submissionCount: 19,
      },
    ],
    quizzes: [
      {
        id: "q3",
        courseId: "ai210",
        courseCode: "AI210",
        title: "Responsible AI Check",
        questionTypes: ["True/False", "MCQ"],
        questions: 12,
        timeLimit: 15,
        status: "draft",
        averageScore: 0,
      },
    ],
    discussionCount: 22,
  },
];

export const academicAssignments = academicCourses.flatMap((course) => course.assignments);
export const academicQuizzes = academicCourses.flatMap((course) => course.quizzes);

export const gpaProgress = [
  { semester: "Y1 S1", gpa: 3.28 },
  { semester: "Y1 S2", gpa: 3.42 },
  { semester: "Y2 S1", gpa: 3.55 },
  { semester: "Y2 S2", gpa: 3.62 },
];

export const gradePerformance = academicCourses.map((course) => ({
  course: course.code,
  grade: course.grade,
  average: Math.max(68, course.grade - 7),
}));

export const attendanceTrend = [
  { week: "W1", attendance: 96 },
  { week: "W2", attendance: 94 },
  { week: "W3", attendance: 92 },
  { week: "W4", attendance: 95 },
  { week: "W5", attendance: 94 },
];

export const teacherClassAnalytics = [
  { label: "Database Systems", performance: 84, attendance: 93, completion: 88 },
  { label: "Software Engineering", performance: 81, attendance: 90, completion: 76 },
  { label: "Applied AI", performance: 78, attendance: 86, completion: 69 },
];

export const studentRiskAlerts: StudentAlert[] = [
  {
    id: "risk-1",
    studentName: "Aaliyah Chen",
    issue: "Attendance below 70%",
    recommendation: "Contact student and schedule advisor check-in.",
    severity: "urgent",
  },
  {
    id: "risk-2",
    studentName: "Benjamin Okafor",
    issue: "Two missing assignments",
    recommendation: "Send reminder and extend support materials.",
    severity: "high",
  },
  {
    id: "risk-3",
    studentName: "Carla Diaz",
    issue: "Grade trend below class average",
    recommendation: "Recommend tutorial session before next quiz.",
    severity: "normal",
  },
];

export const academicCalendarEvents: AcademicCalendarEvent[] = [
  { id: "cal-1", title: "Database Midterm Exam", date: "2026-07-22", type: "exam", course: "CS301", priority: "urgent" },
  { id: "cal-2", title: "Project Milestone 2 Due", date: "2026-07-20", type: "assignment", course: "SE220", priority: "high" },
  { id: "cal-3", title: "University Research Forum", date: "2026-07-27", type: "event", priority: "normal" },
  { id: "cal-4", title: "Constitution Day Holiday", date: "2026-09-24", type: "holiday", priority: "normal" },
];

export const transcriptRecords: TranscriptRecord[] = [
  { id: "tr-1", semester: "Year 1 - Semester 1", courseCode: "MATH101", courseTitle: "Calculus I", credits: 3, gradeLetter: "B+", gradePoint: 3.3 },
  { id: "tr-2", semester: "Year 1 - Semester 1", courseCode: "ENG101", courseTitle: "Academic English", credits: 3, gradeLetter: "A-", gradePoint: 3.7 },
  { id: "tr-3", semester: "Year 1 - Semester 2", courseCode: "CS102", courseTitle: "Programming Fundamentals", credits: 4, gradeLetter: "A", gradePoint: 4.0 },
  { id: "tr-4", semester: "Year 2 - Semester 1", courseCode: "NET210", courseTitle: "Computer Networks", credits: 3, gradeLetter: "B+", gradePoint: 3.3 },
  { id: "tr-5", semester: "Year 2 - Semester 2", courseCode: "CS301", courseTitle: "Database Systems", credits: 3, gradeLetter: "A-", gradePoint: 3.7 },
];

export const messageThreads: MessageThread[] = [
  {
    id: "msg-1",
    person: "Dr. Sok Dara",
    role: "teacher",
    subject: "Database assignment feedback",
    preview: "Please review the note about indexes before your final submission.",
    unread: true,
    time: "10 min ago",
  },
  {
    id: "msg-2",
    person: "Aaliyah Chen",
    role: "student",
    subject: "Attendance support request",
    preview: "I missed class because of a family issue. Can we discuss makeup work?",
    unread: false,
    time: "Yesterday",
  },
  {
    id: "msg-3",
    person: "Ms. Chan Sreypov",
    role: "teacher",
    subject: "Sprint review schedule",
    preview: "Team demos will start next Tuesday at 10 AM.",
    unread: false,
    time: "2 days ago",
  },
];

export const platformNotifications = [
  "Database Midterm Exam starts in 12 days.",
  "1 assignment is still pending submission.",
  "New material uploaded in Software Engineering.",
];
