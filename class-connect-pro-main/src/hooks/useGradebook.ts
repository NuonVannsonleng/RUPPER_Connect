import { useQuery } from "@tanstack/react-query";
import { assignments, grades as initialGrades, students } from "@/data/mockData";

export const GRADEBOOK_QUERY_KEY = ["gradebook"] as const;

export type GradeMap = Record<string, number>;

export const buildInitialGradeMap = (): GradeMap => {
  const map: GradeMap = {};
  initialGrades.forEach((grade) => {
    map[`${grade.studentId}:${grade.assignmentId}`] = grade.score;
  });
  return map;
};

export const calculateStudentAverages = (gradeMap: GradeMap) => {
  const averages: Record<string, number> = {};

  students.forEach((student) => {
    const totals = assignments.reduce(
      (acc, assignment) => {
        const score = gradeMap[`${student.id}:${assignment.id}`] ?? 0;
        acc.score += score;
        acc.max += assignment.maxScore;
        return acc;
      },
      { score: 0, max: 0 }
    );

    averages[student.id] = totals.max ? Math.round((totals.score / totals.max) * 100) : 0;
  });

  return averages;
};

export const calculateClassAverage = (gradeMap: GradeMap) => {
  const maxPossible = students.length * assignments.reduce((sum, assignment) => sum + assignment.maxScore, 0);
  if (!maxPossible) return 0;

  const totalScore = students.reduce(
    (sum, student) =>
      sum +
      assignments.reduce(
        (studentSum, assignment) => studentSum + (gradeMap[`${student.id}:${assignment.id}`] ?? 0),
        0
      ),
    0
  );

  return Math.round((totalScore / maxPossible) * 100);
};

export function useGradebook() {
  return useQuery({
    queryKey: GRADEBOOK_QUERY_KEY,
    queryFn: buildInitialGradeMap,
    initialData: buildInitialGradeMap,
  });
}
