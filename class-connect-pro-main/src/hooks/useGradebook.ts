import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const GRADEBOOK_QUERY_KEY = ["gradebook"] as const;
export const GRADEBOOK_ROSTER_QUERY_KEY = ["gradebook-roster"] as const;
export const GRADEBOOK_SUBJECT = "Algebra II";

export type GradeMap = Record<string, number>;

export interface GradebookColumn {
  id: string;
  title: string;
  maxScore: number;
}

export interface GradebookStudent {
  id: string;
  name: string;
  avatar: string;
  section: string;
}

// Fixed grading columns for the class - the `grades` table stores free-text
// assignment names per score rather than a separate assignment dictionary.
export const GRADEBOOK_COLUMNS: GradebookColumn[] = [
  { id: "Quiz 1 - Algebra", title: "Quiz 1 - Algebra", maxScore: 20 },
  { id: "Homework 1", title: "Homework 1", maxScore: 10 },
  { id: "Midterm Exam", title: "Midterm Exam", maxScore: 100 },
  { id: "Project - Statistics", title: "Project - Statistics", maxScore: 50 },
];

interface ApiGradeRow {
  id: number | string;
  studentId: number | string;
  studentName: string;
  subject: string;
  assignment: string;
  score: number | string;
  maxScore: number | string;
}

interface ApiStudentRow {
  id: number | string;
  name: string;
  email?: string;
  studentId?: string;
  major?: string;
  year?: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const gradeKey = (studentId: string, assignmentId: string) => `${studentId}:${assignmentId}`;

const fetchRoster = async (): Promise<GradebookStudent[]> => {
  const rows = await apiRequest<ApiStudentRow[]>("/attendance/students");
  return rows.map((student) => ({
    id: String(student.id),
    name: student.name,
    avatar: initials(student.name),
    section: student.year || student.major || "Student",
  }));
};

const fetchGradeMap = async (): Promise<GradeMap> => {
  const rows = await apiRequest<ApiGradeRow[]>("/grades");
  const map: GradeMap = {};
  rows.forEach((row) => {
    map[gradeKey(String(row.studentId), row.assignment)] = Number(row.score);
  });
  return map;
};

export function useGradebookRoster() {
  return useQuery({
    queryKey: GRADEBOOK_ROSTER_QUERY_KEY,
    queryFn: fetchRoster,
    initialData: [],
  });
}

export function useGradebook() {
  return useQuery({
    queryKey: GRADEBOOK_QUERY_KEY,
    queryFn: fetchGradeMap,
    initialData: {},
  });
}

export const calculateStudentAverages = (gradeMap: GradeMap, roster: GradebookStudent[]) => {
  const averages: Record<string, number> = {};

  roster.forEach((student) => {
    const totals = GRADEBOOK_COLUMNS.reduce(
      (acc, column) => {
        const key = gradeKey(student.id, column.id);
        if (key in gradeMap) {
          acc.score += gradeMap[key];
          acc.max += column.maxScore;
        }
        return acc;
      },
      { score: 0, max: 0 }
    );

    averages[student.id] = totals.max ? Math.round((totals.score / totals.max) * 100) : 0;
  });

  return averages;
};

export const calculateClassAverage = (gradeMap: GradeMap, roster: GradebookStudent[]) => {
  const averages = Object.values(calculateStudentAverages(gradeMap, roster));
  if (!averages.length) return 0;
  return Math.round(averages.reduce((sum, value) => sum + value, 0) / averages.length);
};
