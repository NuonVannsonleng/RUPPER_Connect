import { describe, it, expect } from "vitest";

/**
 * The two pure pieces of the quiz feature: the rules a teacher's question set has to satisfy,
 * and the marking those rules make possible.
 *
 * The controller needs a database handle at import time, so the environment is set up the same
 * way test/authorization.test.mjs does it - a connection string that is never dialled, since
 * nothing here touches the pool.
 */

process.env.JWT_SECRET ||= "test-secret-long-enough-to-pass-the-32-character-check";
process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/unused";

const { gradeQuizAnswers, normalizeQuizQuestions } = (await import("../controllers/academicController.js")).__testing;

const mcq = (overrides = {}) => ({
  question: "Which keyword selects rows?",
  type: "mcq",
  options: ["SELECT", "INSERT", "DELETE"],
  correctAnswer: "SELECT",
  points: 1,
  ...overrides,
});

describe("question validation", () => {
  it("accepts a well-formed multiple-choice question", () => {
    const { questions, error } = normalizeQuizQuestions([mcq()]);
    expect(error).toBeUndefined();
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({ type: "mcq", correctAnswer: "SELECT", points: 1 });
  });

  it("fixes the options for a true/false question regardless of what was sent", () => {
    const { questions } = normalizeQuizQuestions([
      { question: "SQL is declarative", type: "true_false", options: ["yes", "no", "maybe"], correctAnswer: "True" },
    ]);
    expect(questions[0].options).toEqual(["True", "False"]);
  });

  it("rejects a correct answer that isn't one of the options", () => {
    const { error } = normalizeQuizQuestions([mcq({ correctAnswer: "UPDATE" })]);
    expect(error).toMatch(/has to be one of its options/i);
  });

  it("rejects a question with no answer key marked", () => {
    const { error } = normalizeQuizQuestions([mcq({ correctAnswer: "" })]);
    expect(error).toMatch(/needs a correct answer/i);
  });

  it("rejects blank question text, too few options, and duplicates", () => {
    expect(normalizeQuizQuestions([mcq({ question: "   " })]).error).toMatch(/needs some text/i);
    expect(normalizeQuizQuestions([mcq({ options: ["Only one"], correctAnswer: "Only one" })]).error).toMatch(
      /at least two/i
    );
    expect(normalizeQuizQuestions([mcq({ options: ["A", "A", "B"] })]).error).toMatch(/duplicate/i);
  });

  it("rejects an unusable points value", () => {
    expect(normalizeQuizQuestions([mcq({ points: 0 })]).error).toMatch(/points/i);
    expect(normalizeQuizQuestions([mcq({ points: -5 })]).error).toMatch(/points/i);
  });

  it("numbers the problem question so a teacher knows which one to fix", () => {
    const { error } = normalizeQuizQuestions([mcq(), mcq(), mcq({ correctAnswer: "" })]);
    expect(error).toMatch(/question 3/i);
  });

  it("distinguishes 'no questions key sent' from 'an empty list'", () => {
    expect(normalizeQuizQuestions(undefined).questions).toBeNull();
    expect(normalizeQuizQuestions([]).questions).toEqual([]);
  });
});

describe("auto grading", () => {
  const questions = [
    { id: "1", question: "Q1", type: "mcq", options: ["A", "B"], correctAnswer: "A", points: 1 },
    { id: "2", question: "Q2", type: "true_false", options: ["True", "False"], correctAnswer: "False", points: 2 },
    { id: "3", question: "Q3", type: "mcq", options: ["X", "Y"], correctAnswer: "Y", points: 3 },
  ];

  it("awards each question's own points, not one mark per question", () => {
    const result = gradeQuizAnswers(questions, { 1: "A", 2: "False", 3: "Y" });
    expect(result.score).toBe(6);
    expect(result.maxScore).toBe(6);
    expect(result.correctCount).toBe(3);
  });

  it("scores a mixed attempt on the weighted total", () => {
    // Right on the 1-pointer, wrong on the 2, right on the 3.
    const result = gradeQuizAnswers(questions, { 1: "A", 2: "True", 3: "Y" });
    expect(result.score).toBe(4);
    expect(result.correctCount).toBe(2);
  });

  it("scores unanswered questions as zero instead of failing", () => {
    const result = gradeQuizAnswers(questions, { 1: "A" });
    expect(result.score).toBe(1);
    expect(result.detail[1].chosen).toBeNull();
    expect(result.detail[1].isCorrect).toBe(false);
  });

  it("gives nothing for an empty submission", () => {
    const result = gradeQuizAnswers(questions, {});
    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.maxScore).toBe(6);
  });

  it("matches the answer exactly, so casing doesn't leak a mark", () => {
    expect(gradeQuizAnswers(questions, { 2: "false" }).score).toBe(0);
    expect(gradeQuizAnswers(questions, { 2: "False" }).score).toBe(2);
  });

  it("ignores an answer naming an option that doesn't exist", () => {
    const result = gradeQuizAnswers(questions, { 1: "Z" });
    expect(result.score).toBe(0);
    expect(result.detail[0].chosen).toBe("Z");
    expect(result.detail[0].isCorrect).toBe(false);
  });

  it("records the answer key on every question so a review can show it", () => {
    const result = gradeQuizAnswers(questions, { 1: "B" });
    expect(result.detail[0]).toMatchObject({ chosen: "B", correctAnswer: "A", isCorrect: false, earned: 0, points: 1 });
  });

  it("handles a quiz with no questions without dividing by anything", () => {
    const result = gradeQuizAnswers([], {});
    expect(result).toMatchObject({ score: 0, maxScore: 0, correctCount: 0 });
    expect(result.detail).toEqual([]);
  });
});
