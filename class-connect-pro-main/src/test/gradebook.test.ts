import { describe, it, expect } from "vitest";
import {
  GRADEBOOK_COLUMNS,
  calculateClassAverage,
  calculateStudentAverages,
  gradeKey,
  type GradebookStudent,
  type GradeMap,
} from "@/hooks/useGradebook";

const student = (id: string, name = `Student ${id}`): GradebookStudent => ({
  id,
  name,
  avatar: name.slice(0, 2).toUpperCase(),
  section: "Year 2",
});

const [quiz, homework, midterm] = GRADEBOOK_COLUMNS;

describe("calculateStudentAverages", () => {
  it("averages against only the work that has been graded", () => {
    // Half marks on one column and nothing else entered should read 50%, not a number
    // dragged down by columns the teacher hasn't marked yet.
    const roster = [student("1")];
    const grades: GradeMap = { [gradeKey("1", quiz.id)]: quiz.maxScore / 2 };

    expect(calculateStudentAverages(grades, roster)["1"]).toBe(50);
  });

  it("weights columns by their maximum score rather than treating them equally", () => {
    // Full marks on a 10-point homework and zero on a 100-point midterm is a bad result,
    // not the 50% a naive per-column mean would report.
    const roster = [student("1")];
    const grades: GradeMap = {
      [gradeKey("1", homework.id)]: homework.maxScore,
      [gradeKey("1", midterm.id)]: 0,
    };

    const expected = Math.round((homework.maxScore / (homework.maxScore + midterm.maxScore)) * 100);
    expect(calculateStudentAverages(grades, roster)["1"]).toBe(expected);
    expect(expected).toBeLessThan(50);
  });

  it("reports 0 for a student with no grades instead of dividing by zero", () => {
    expect(calculateStudentAverages({}, [student("1")])["1"]).toBe(0);
  });

  it("keeps each student's average independent of the others", () => {
    const roster = [student("1"), student("2")];
    const grades: GradeMap = {
      [gradeKey("1", quiz.id)]: quiz.maxScore,
      [gradeKey("2", quiz.id)]: 0,
    };

    const averages = calculateStudentAverages(grades, roster);
    expect(averages["1"]).toBe(100);
    expect(averages["2"]).toBe(0);
  });

  it("ignores grades belonging to students who are not on the roster", () => {
    const grades: GradeMap = {
      [gradeKey("1", quiz.id)]: quiz.maxScore,
      [gradeKey("ghost", quiz.id)]: 0,
    };

    const averages = calculateStudentAverages(grades, [student("1")]);
    expect(Object.keys(averages)).toEqual(["1"]);
  });
});

describe("calculateClassAverage", () => {
  it("returns 0 for an empty roster rather than NaN", () => {
    // An empty class used to render "NaN%" on the dashboard.
    expect(calculateClassAverage({}, [])).toBe(0);
  });

  it("sits between the strongest and weakest student", () => {
    const roster = [student("1"), student("2")];
    const grades: GradeMap = {
      [gradeKey("1", quiz.id)]: quiz.maxScore,
      [gradeKey("2", quiz.id)]: 0,
    };

    expect(calculateClassAverage(grades, roster)).toBe(50);
  });
});

describe("gradeKey", () => {
  it("round-trips a student id and a column title containing separators", () => {
    // Column ids are human titles like "Quiz 1 - Algebra", so the key format has to
    // survive dashes and spaces; the save path splits on the first colon only.
    const key = gradeKey("42", "Quiz 1 - Algebra");
    const [studentId, assignment] = key.split(/:(.+)/);

    expect(studentId).toBe("42");
    expect(assignment).toBe("Quiz 1 - Algebra");
  });
});
