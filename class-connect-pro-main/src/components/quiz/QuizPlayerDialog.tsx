import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Award, CheckCircle2, Clock3, Loader2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { formatMoment } from "@/lib/quizSchedule";
import type { QuizAnswerDetail, QuizDetail, QuizSubmissionResult } from "@/data/academicPlatform";

type Phase = "intro" | "taking" | "review";

const formatClock = (totalSeconds: number) => {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

interface QuizPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: QuizDetail | null;
  isLoadingDetail?: boolean;
  onSubmitted: () => void | Promise<void>;
}

export function QuizPlayerDialog({ open, onOpenChange, detail, isLoadingDetail, onSubmitted }: QuizPlayerDialogProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  // Guards the timer's auto-submit against also firing from a manual click.
  const submittedRef = useRef(false);

  const questions = detail?.questions ?? [];
  const total = questions.length;
  const current = questions[index];
  const answeredCount = Object.keys(answers).length;

  // An attempt already on record means this opens straight into the review of it.
  const priorAttempt = detail?.attempt ?? null;

  useEffect(() => {
    if (!open) return;
    submittedRef.current = false;
    setAnswers({});
    setIndex(0);
    setResult(null);
    setIsSubmitting(false);
    if (priorAttempt) {
      setPhase("review");
    } else {
      setPhase("intro");
      // The server works out what's actually left: the quiz's own limit, or less when its
      // closing time comes first. Falling back to the limit keeps this working if it's absent.
      setSecondsLeft(detail?.secondsAllowed ?? (detail?.timeLimit ?? 20) * 60);
    }
  }, [open, detail, priorAttempt]);

  const submit = useCallback(
    async (auto = false) => {
      if (!detail || submittedRef.current) return;
      submittedRef.current = true;
      setIsSubmitting(true);
      try {
        const response = await apiRequest<QuizSubmissionResult>(`/academic/quizzes/${detail.id}/attempts`, {
          method: "POST",
          body: JSON.stringify({ answers }),
        });
        setResult(response);
        setPhase("review");
        await onSubmitted();
        toast.success(auto ? "Time is up - your answers were submitted" : "Quiz submitted");
      } catch (error) {
        submittedRef.current = false;
        toast.error(error instanceof Error ? error.message : "Could not submit the quiz");
      } finally {
        setIsSubmitting(false);
      }
    },
    [answers, detail, onSubmitted]
  );

  // Countdown only while actually taking the quiz; hitting zero submits whatever is answered.
  useEffect(() => {
    if (phase !== "taking") return;
    const timer = window.setInterval(() => {
      setSecondsLeft((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(timer);
          void submit(true);
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, submit]);

  const reviewDetail: QuizAnswerDetail[] = result?.detail ?? priorAttempt?.detail ?? [];
  const reviewScore = result?.score ?? priorAttempt?.score ?? 0;
  const reviewMax = result?.maxScore ?? priorAttempt?.maxScore ?? detail?.maxScore ?? 0;

  const closeAfterConfirm = (next: boolean) => {
    if (next) return;
    if (phase === "taking" && !submittedRef.current) {
      const confirmed = window.confirm("Leave the quiz? Your answers won't be recorded.");
      if (!confirmed) return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={closeAfterConfirm}>
      <DialogContent className="flex h-[92dvh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="truncate">{detail?.title ?? "Quiz"}</span>
            {phase === "taking" && (
              <Badge
                className={cn(
                  "shrink-0 gap-1.5 border tabular-nums transition-base",
                  secondsLeft <= 30
                    ? "animate-pulse border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-primary/20 bg-primary/10 text-primary"
                )}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {formatClock(secondsLeft)}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoadingDetail || !detail ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading quiz...
          </div>
        ) : phase === "intro" ? (
          <IntroPanel detail={detail} onStart={() => setPhase("taking")} />
        ) : phase === "taking" ? (
          <>
            <div className="border-b border-border px-6 py-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Question {index + 1} of {total}
                </span>
                <span>{answeredCount} answered</span>
              </div>
              <Progress value={total ? ((index + 1) / total) * 100 : 0} className="h-1.5" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {current && (
                // Keyed on the question so each one animates in as you move through them.
                <div key={current.id} className="animate-fade-in space-y-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold leading-snug text-foreground">{current.question}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {current.points} {current.points === 1 ? "point" : "points"} -{" "}
                        {current.type === "true_false" ? "True or false" : "Choose one answer"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {current.options.map((option, optionIndex) => {
                      const selected = answers[current.id] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: option }))}
                          style={{ animationDelay: `${optionIndex * 40}ms` }}
                          className={cn(
                            "flex w-full animate-fade-in items-center gap-3 rounded-xl border p-4 text-left transition-base",
                            selected
                              ? "border-primary bg-primary/10 shadow-soft"
                              : "border-border/60 bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-base",
                              selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                            )}
                          >
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="text-sm font-medium text-foreground">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>

              <div className="flex max-w-[45%] flex-wrap justify-center gap-1.5 overflow-y-auto">
                {questions.map((question, dotIndex) => (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setIndex(dotIndex)}
                    title={`Question ${dotIndex + 1}`}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full transition-base hover:scale-125",
                      dotIndex === index
                        ? "w-5 bg-primary"
                        : answers[question.id]
                          ? "bg-success"
                          : "bg-border"
                    )}
                  />
                ))}
              </div>

              {index === total - 1 ? (
                <Button
                  onClick={() => void submit(false)}
                  disabled={isSubmitting}
                  className="bg-gradient-primary text-primary-foreground"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit
                </Button>
              ) : (
                <Button onClick={() => setIndex((i) => i + 1)} className="bg-gradient-primary text-primary-foreground">
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        ) : (
          <ReviewPanel
            detail={reviewDetail}
            score={reviewScore}
            maxScore={reviewMax}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IntroPanel({ detail, onStart }: { detail: QuizDetail; onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="animate-fade-in flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary shadow-elegant">
        <Play className="h-9 w-9 text-primary-foreground" />
      </div>

      <div className="animate-fade-in space-y-2">
        <h2 className="font-display text-2xl font-bold text-foreground">{detail.title}</h2>
        {detail.description && <p className="max-w-md text-sm text-muted-foreground">{detail.description}</p>}
      </div>

      <div className="animate-fade-in grid w-full max-w-md grid-cols-3 gap-3">
        <IntroStat label="Questions" value={detail.questions.length} />
        <IntroStat label="Points" value={detail.maxScore} />
        <IntroStat label="Minutes" value={Math.ceil((detail.secondsAllowed ?? detail.timeLimit * 60) / 60)} />
      </div>

      {detail.closesAt && (
        <p className="animate-fade-in text-xs text-muted-foreground">
          This quiz closes at <strong className="text-foreground">{formatMoment(detail.closesAt)}</strong>
          {(detail.secondsAllowed ?? Infinity) < detail.timeLimit * 60 &&
            " - less than the full time limit, so you have until then."}
        </p>
      )}

      <div className="animate-fade-in flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-left text-xs text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The timer starts as soon as you begin and doesn't pause. When it runs out, whatever you've answered is
          submitted automatically.
        </p>
      </div>

      <Button size="lg" onClick={onStart} className="animate-fade-in bg-gradient-primary text-primary-foreground">
        Start quiz <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function IntroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ReviewPanel({
  detail,
  score,
  maxScore,
  onClose,
}: {
  detail: QuizAnswerDetail[];
  score: number;
  maxScore: number;
  onClose: () => void;
}) {
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const correctCount = detail.filter((item) => item.isCorrect).length;
  // Counts up to the final score once, so the result lands with a bit of weight.
  const displayScore = useCountUp(score);

  const tone = percent >= 80 ? "success" : percent >= 50 ? "warning" : "destructive";
  const toneClasses = {
    success: "from-success/20 to-success/5 text-success",
    warning: "from-warning/20 to-warning/5 text-warning",
    destructive: "from-destructive/20 to-destructive/5 text-destructive",
  }[tone];

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div
          className={cn(
            "animate-fade-in mb-6 flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-b p-6 text-center",
            toneClasses
          )}
        >
          <Award className="h-10 w-10" />
          <div>
            <p className="font-display text-4xl font-bold tabular-nums text-foreground">
              {displayScore}
              <span className="text-2xl text-muted-foreground">/{maxScore}</span>
            </p>
            <p className="mt-1 text-sm font-semibold">{percent}% - {correctCount} of {detail.length} correct</p>
          </div>
          <Progress value={percent} className="h-2 w-full max-w-xs" />
        </div>

        {detail.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            This attempt was recorded before answer review was available, so only the score is stored.
          </p>
        ) : (
          <div className="space-y-3">
            {detail.map((item, itemIndex) => (
              <div
                key={item.questionId}
                style={{ animationDelay: `${itemIndex * 50}ms` }}
                className={cn(
                  "animate-fade-in rounded-xl border p-4",
                  item.isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                )}
              >
                <div className="flex items-start gap-3">
                  {item.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      <span className="text-muted-foreground">{itemIndex + 1}. </span>
                      {item.question}
                    </p>

                    <div className="mt-2 space-y-1 text-sm">
                      <p className={item.isCorrect ? "text-success" : "text-destructive"}>
                        Your answer: <strong>{item.chosen ?? "Not answered"}</strong>
                      </p>
                      {!item.isCorrect && (
                        <p className="text-success">
                          Correct answer: <strong>{item.correctAnswer}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {item.earned}/{item.points}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4 text-right">
        <Button onClick={onClose} className="bg-gradient-primary text-primary-foreground">
          Done
        </Button>
      </div>
    </>
  );
}

/** Eases a number up from zero over ~700ms. Falls straight to the target if the value changes. */
function useCountUp(target: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 700;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
