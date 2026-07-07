// Centralised mock data for RUPPER CONNECT.
// Each export mirrors a future API resource - swap for fetch/axios calls later.

export interface Student {
  id: string;
  name: string;
  avatar: string;
  section: string;
}

export interface AttendanceRecord {
  studentId: string;
  status: "present" | "absent" | "late";
}

export interface Assignment {
  id: string;
  title: string;
  maxScore: number;
}

export interface Grade {
  studentId: string;
  assignmentId: string;
  score: number;
}

export interface ScheduleItem {
  id: string;
  day: string;
  time: string;
  subject: string;
  room: string;
  teacher: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  date: string;
  category: "exam" | "event" | "general" | "urgent";
}

export const students: Student[] = [
  { id: "s1", name: "Aaliyah Chen",     avatar: "AC", section: "11-A" },
  { id: "s2", name: "Benjamin Okafor",  avatar: "BO", section: "11-A" },
  { id: "s3", name: "Carla Diaz",       avatar: "CD", section: "11-A" },
  { id: "s4", name: "Dmitri Volkov",    avatar: "DV", section: "11-A" },
  { id: "s5", name: "Eleanor Park",     avatar: "EP", section: "11-A" },
  { id: "s6", name: "Faisal Rahman",    avatar: "FR", section: "11-A" },
  { id: "s7", name: "Grace Thompson",   avatar: "GT", section: "11-A" },
  { id: "s8", name: "Hiro Tanaka",      avatar: "HT", section: "11-A" },
  { id: "s9", name: "Isabella Romano",  avatar: "IR", section: "11-A" },
  { id: "s10", name: "Jamal Williams",  avatar: "JW", section: "11-A" },
];

export const assignments: Assignment[] = [
  { id: "a1", title: "Quiz 1 - Algebra",      maxScore: 20 },
  { id: "a2", title: "Homework 1",            maxScore: 10 },
  { id: "a3", title: "Midterm Exam",          maxScore: 100 },
  { id: "a4", title: "Project - Statistics",  maxScore: 50 },
];

// deterministic mock grades
export const grades: Grade[] = students.flatMap((s, i) =>
  assignments.map((a, j) => ({
    studentId: s.id,
    assignmentId: a.id,
    score: Math.round(a.maxScore * (0.6 + ((i * 7 + j * 13) % 35) / 100)),
  }))
);

export const schedule: ScheduleItem[] = [
  { id: "sc1", day: "Monday",    time: "08:00 - 09:30", subject: "Algebra II",          room: "R-204", teacher: "Prof. Rupper" },
  { id: "sc2", day: "Monday",    time: "10:00 - 11:30", subject: "World History",       room: "R-110", teacher: "Ms. Adeyemi" },
  { id: "sc3", day: "Tuesday",   time: "08:00 - 09:30", subject: "Physics",             room: "Lab-3", teacher: "Dr. Khan" },
  { id: "sc4", day: "Tuesday",   time: "13:00 - 14:30", subject: "English Literature",  room: "R-301", teacher: "Mr. Bennett" },
  { id: "sc5", day: "Wednesday", time: "09:00 - 10:30", subject: "Algebra II",          room: "R-204", teacher: "Prof. Rupper" },
  { id: "sc6", day: "Wednesday", time: "11:00 - 12:30", subject: "Computer Science",    room: "Lab-1", teacher: "Ms. Chen" },
  { id: "sc7", day: "Thursday",  time: "08:00 - 09:30", subject: "Chemistry",           room: "Lab-2", teacher: "Dr. Patel" },
  { id: "sc8", day: "Thursday",  time: "13:00 - 14:30", subject: "Physical Education",  room: "Gym",   teacher: "Coach Diaz" },
  { id: "sc9", day: "Friday",    time: "09:00 - 10:30", subject: "Algebra II",          room: "R-204", teacher: "Prof. Rupper" },
  { id: "sc10", day: "Friday",   time: "11:00 - 12:30", subject: "Art & Design",        room: "Studio", teacher: "Ms. Romano" },
];

export const announcements: Announcement[] = [
  {
    id: "n1",
    title: "Midterm Exam Schedule Published",
    body: "The complete midterm schedule for all sections is now available. Please check your subject-wise dates and report to assigned rooms 15 minutes early.",
    author: "Academic Office",
    date: "2 hours ago",
    category: "exam",
  },
  {
    id: "n2",
    title: "Inter-section Science Fair - Sign-ups open",
    body: "Teams of 2-3 students can register for the annual science fair. Theme: Sustainability and Climate. Deadline: next Friday.",
    author: "Dr. Patel",
    date: "Yesterday",
    category: "event",
  },
  {
    id: "n3",
    title: "Library hours extended this week",
    body: "Library will remain open until 8 PM Monday through Thursday during exam preparation week.",
    author: "Library Admin",
    date: "2 days ago",
    category: "general",
  },
  {
    id: "n4",
    title: "URGENT: Wednesday classes rescheduled",
    body: "Due to the staff development workshop, all Wednesday afternoon classes will be moved to Saturday morning. Updated schedule on portal.",
    author: "Principal's Office",
    date: "3 days ago",
    category: "urgent",
  },
];
