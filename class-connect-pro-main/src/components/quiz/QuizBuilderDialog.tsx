import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Copy,
  GripVertical,
  ListChecks,
  Loader2,
  Plus,
  ToggleLeft,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import type { AcademicCourse, QuizDetail, QuizQuestionType } from "@/data/academicPlatform";

const TRUE_FALSE_OPTIONS = ["True", "False"];
const MAX_OPTIONS = 8;

interface DraftQuestion {
  key: string;
  question: string;
  type: QuizQuestionType;
  options: string[];
  correctAnswer: string;
  points: number;
}

let draftKeySeed = 0;
const nextKey = () => `q-${(draftKeySeed += 1)}`;

const blankQuestion = (): DraftQuestion => ({
  key: nextKey(),
  question: "",
  type: "mcq",
  options: ["", ""],
  correctAnswer: "",
  points: 1,
});

const fromDetail = (detail: QuizDetail): DraftQuestion[] =>
  detail.questions.map((question) => ({
    key: nextKey(),
    question: question.question,
    type: question.type,
    options: question.type === "true_false" ? [...TRUE_FALSE_OPTIONS] : [...question.options],
    correctAnswer: question.correctAnswer ?? "",
    points: question.points,
  }));

interface QuizBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing quiz to edit, or null to author a new one. */
  detail: QuizDetail | null;
  isLoadingDetail?: boolean;
  courses: AcademicCourse[];
  onSaved: () => void | Promise<void>;
}

export function QuizBuilderDialog({
  open,
  onOpenChange,
  detail,
  isLoadingDetail,
  courses,
  onSaved,
}: QuizBuilderDialogProps) {
  const isEditing = Boolean(detail);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState("20");
  const [status, setStatus] = useState<"draft" | "available" | "closed">("draft");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion()]);
  const [isSaving, setIsSaving] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Reset whenever the dialog is opened, so a previous quiz's questions never bleed into the
  // next one and "New quiz" always starts clean.
  useEffect(() => {
    if (!open) return;
    if (detail) {
      setCourseId(detail.courseId);
      setTitle(detail.title);
      setDescription(detail.description);
      setTimeLimit(String(detail.timeLimit));
      setStatus(detail.status);
      setQuestions(detail.questions.length ? fromDetail(detail) : [blankQuestion()]);
    } else {
      setCourseId(courses[0]?.id ?? "");
      setTitle("");
      setDescription("");
      setTimeLimit("20");
      setStatus("draft");
      setQuestions([blankQuestion()]);
    }
  }, [open, detail, courses]);

  const totalPoints = useMemo(
    () => questions.reduce((total, question) => total + (Number(question.points) || 0), 0),
    [questions]
  );
  const answeredCount = questions.filter((question) => question.correctAnswer.trim()).length;

  const patch = (key: string, changes: Partial<DraftQuestion>) =>
    setQuestions((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  const addQuestion = () => {
    setQuestions((current) => [...current, blankQuestion()]);
    // Let the new card mount before scrolling it into view.
    window.setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  };

  const duplicateQuestion = (key: string) =>
    setQuestions((current) => {
      const index = current.findIndex((item) => item.key === key);
      if (index === -1) return current;
      const copy = { ...current[index], key: nextKey(), options: [...current[index].options] };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });

  const removeQuestion = (key: string) =>
    setQuestions((current) => (current.length === 1 ? current : current.filter((item) => item.key !== key)));

  const moveQuestion = (key: string, direction: -1 | 1) =>
    setQuestions((current) => {
      const index = current.findIndex((item) => item.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const changeType = (key: string, type: QuizQuestionType) =>
    setQuestions((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (type === "true_false") {
          return { ...item, type, options: [...TRUE_FALSE_OPTIONS], correctAnswer: "" };
        }
        // Coming back from true/false, the True/False pair isn't a useful starting point.
        const restored = item.options.length && item.options.join() !== TRUE_FALSE_OPTIONS.join() ? item.options : ["", ""];
        return { ...item, type, options: restored, correctAnswer: "" };
      })
    );

  const setOption = (key: string, index: number, value: string) =>
    setQuestions((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const options = item.options.map((option, i) => (i === index ? value : option));
        // If the edited option was the marked answer, keep the mark on it as it's renamed.
        const wasCorrect = item.correctAnswer && item.correctAnswer === item.options[index];
        return { ...item, options, correctAnswer: wasCorrect ? value : item.correctAnswer };
      })
    );

  const addOption = (key: string) =>
    setQuestions((current) =>
      current.map((item) =>
        item.key === key && item.options.length < MAX_OPTIONS ? { ...item, options: [...item.options, ""] } : item
      )
    );

  const removeOption = (key: string, index: number) =>
    setQuestions((current) =>
      current.map((item) => {
        if (item.key !== key || item.options.length <= 2) return item;
        const removed = item.options[index];
        return {
          ...item,
          options: item.options.filter((_, i) => i !== index),
          correctAnswer: item.correctAnswer === removed ? "" : item.correctAnswer,
        };
      })
    );

  /** Mirrors the server's rules so problems surface inline instead of as a toast from the API. */
  const findProblem = () => {
    if (!courseId) return "Choose a course for this quiz.";
    if (!title.trim()) return "Give the quiz a title.";
    const minutes = Number(timeLimit);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) return "Time limit must be 1-600 minutes.";

    for (const [index, question] of questions.entries()) {
      const position = index + 1;
      if (!question.question.trim()) return `Question ${position} needs some text.`;
      const options = question.options.map((option) => option.trim()).filter(Boolean);
      if (question.type === "mcq") {
        if (options.length < 2) return `Question ${position} needs at least two options.`;
        if (new Set(options).size !== options.length) return `Question ${position} has duplicate options.`;
      }
      if (!question.correctAnswer.trim()) return `Mark the correct answer for question ${position}.`;
      if (!options.includes(question.correctAnswer.trim())) {
        return `The correct answer for question ${position} must be one of its options.`;
      }
      if (!Number.isFinite(question.points) || question.points <= 0) {
        return `Question ${position} needs a points value above zero.`;
      }
    }
    return null;
  };

  const save = async () => {
    const problem = findProblem();
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsSaving(true);
    try {
      const body = JSON.stringify({
        courseId,
        title: title.trim(),
        description: description.trim(),
        timeLimit: Number(timeLimit),
        status,
        questions: questions.map((question) => ({
          question: question.question.trim(),
          type: question.type,
          options: question.options.map((option) => option.trim()).filter(Boolean),
          correctAnswer: question.correctAnswer.trim(),
          points: Number(question.points),
        })),
      });

      await apiRequest(detail ? `/academic/quizzes/${detail.id}` : "/academic/quizzes", {
        method: detail ? "PUT" : "POST",
        body,
      });

      await onSaved();
      toast.success(detail ? "Quiz updated" : "Quiz created");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the quiz");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            {isEditing ? "Edit quiz" : "Build a quiz"}
          </DialogTitle>
        </DialogHeader>

        {isLoadingDetail ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading quiz...
          </div>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="quiz-title">Title</Label>
                <Input
                  id="quiz-title"
                  className="mt-1"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Chapter 4 check"
                />
              </div>
              <div>
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quiz-time">Time limit (minutes)</Label>
                <Input
                  id="quiz-time"
                  className="mt-1"
                  type="number"
                  min={1}
                  max={600}
                  value={timeLimit}
                  onChange={(event) => setTimeLimit(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="quiz-description">Description</Label>
                <Textarea
                  id="quiz-description"
                  className="mt-1 min-h-[4.5rem]"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What does this quiz cover?"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Visibility</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: "draft", label: "Draft", hint: "Only you can see it" },
                      { value: "available", label: "Published", hint: "Students can take it" },
                      { value: "closed", label: "Closed", hint: "No new attempts" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatus(option.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-base hover:-translate-y-0.5",
                        status === option.value
                          ? "border-primary bg-primary/10 shadow-soft"
                          : "border-border/60 bg-secondary/30 hover:border-primary/40"
                      )}
                    >
                      <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{questions.length} questions</Badge>
                <Badge variant="secondary">{totalPoints} points</Badge>
                <Badge
                  className={cn(
                    "border",
                    answeredCount === questions.length
                      ? "border-success/20 bg-success/10 text-success"
                      : "border-warning/20 bg-warning/10 text-warning"
                  )}
                >
                  {answeredCount}/{questions.length} answer keys set
                </Badge>
              </div>
              <Button size="sm" variant="secondary" onClick={addQuestion}>
                <Plus className="mr-2 h-4 w-4" /> Add question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((question, index) => (
                <QuestionEditor
                  key={question.key}
                  index={index}
                  total={questions.length}
                  question={question}
                  onChange={(changes) => patch(question.key, changes)}
                  onChangeType={(type) => changeType(question.key, type)}
                  onSetOption={(optionIndex, value) => setOption(question.key, optionIndex, value)}
                  onAddOption={() => addOption(question.key)}
                  onRemoveOption={(optionIndex) => removeOption(question.key, optionIndex)}
                  onDuplicate={() => duplicateQuestion(question.key)}
                  onRemove={() => removeQuestion(question.key)}
                  onMove={(direction) => moveQuestion(question.key, direction)}
                />
              ))}
              <div ref={listEndRef} />
            </div>

            <Button variant="outline" className="w-full border-dashed" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" /> Add another question
            </Button>
          </div>
        )}

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving} className="bg-gradient-primary text-primary-foreground">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Create quiz"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface QuestionEditorProps {
  index: number;
  total: number;
  question: DraftQuestion;
  onChange: (changes: Partial<DraftQuestion>) => void;
  onChangeType: (type: QuizQuestionType) => void;
  onSetOption: (index: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

function QuestionEditor({
  index,
  total,
  question,
  onChange,
  onChangeType,
  onSetOption,
  onAddOption,
  onRemoveOption,
  onDuplicate,
  onRemove,
  onMove,
}: QuestionEditorProps) {
  const isTrueFalse = question.type === "true_false";

  return (
    <div className="animate-fade-in rounded-2xl border border-border/60 bg-card p-4 shadow-soft transition-base hover:border-primary/30">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex flex-col items-center gap-1 text-muted-foreground">
          <GripVertical className="h-4 w-4 opacity-40" />
          <span className="text-xs font-bold text-primary">{index + 1}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <Textarea
            value={question.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder={`Question ${index + 1}`}
            className="min-h-[3rem] resize-none border-transparent bg-secondary/40 text-base font-medium focus-visible:border-primary"
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/60 bg-secondary/30 p-0.5">
              <TypeTab active={!isTrueFalse} onClick={() => onChangeType("mcq")} icon={ListChecks} label="Multiple choice" />
              <TypeTab active={isTrueFalse} onClick={() => onChangeType("true_false")} icon={ToggleLeft} label="True / False" />
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`points-${question.key}`} className="text-xs text-muted-foreground">
                Points
              </Label>
              <Input
                id={`points-${question.key}`}
                type="number"
                min={1}
                value={question.points}
                onChange={(event) => onChange({ points: Number(event.target.value) })}
                className="h-8 w-16"
              />
            </div>
          </div>

          <div className="space-y-2">
            {question.options.map((option, optionIndex) => {
              const trimmed = option.trim();
              const isCorrect = Boolean(trimmed) && question.correctAnswer === trimmed;
              return (
                <div
                  key={optionIndex}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-base",
                    isCorrect ? "border-success/40 bg-success/10" : "border-border/50 bg-background"
                  )}
                >
                  <button
                    type="button"
                    title="Mark as the correct answer"
                    onClick={() => trimmed && onChange({ correctAnswer: trimmed })}
                    className="shrink-0 text-muted-foreground transition-base hover:scale-110 disabled:opacity-40"
                    disabled={!trimmed}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  {isTrueFalse ? (
                    <span className="flex-1 text-sm font-medium text-foreground">{option}</span>
                  ) : (
                    <Input
                      value={option}
                      onChange={(event) => onSetOption(optionIndex, event.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="h-8 flex-1 border-transparent bg-transparent focus-visible:border-primary"
                    />
                  )}

                  {!isTrueFalse && question.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => onRemoveOption(optionIndex)}
                      className="shrink-0 text-muted-foreground transition-base hover:text-destructive"
                      title="Remove option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {!isTrueFalse && question.options.length < MAX_OPTIONS && (
              <Button variant="ghost" size="sm" onClick={onAddOption} className="text-muted-foreground">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add option
              </Button>
            )}
          </div>

          {!question.correctAnswer.trim() && (
            <p className="animate-fade-in text-xs text-warning">
              Tick the circle next to the correct answer so this question can be graded automatically.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <IconAction title="Move up" disabled={index === 0} onClick={() => onMove(-1)} icon={ArrowUp} />
          <IconAction title="Move down" disabled={index === total - 1} onClick={() => onMove(1)} icon={ArrowDown} />
          <IconAction title="Duplicate" onClick={onDuplicate} icon={Copy} />
          <IconAction title="Delete" disabled={total === 1} onClick={onRemove} icon={Trash2} danger />
        </div>
      </div>
    </div>
  );
}

function TypeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ListChecks;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-base",
        active ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function IconAction({
  title,
  onClick,
  icon: Icon,
  disabled,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: typeof ArrowUp;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-base hover:bg-secondary disabled:opacity-30",
        danger ? "hover:text-destructive" : "hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
