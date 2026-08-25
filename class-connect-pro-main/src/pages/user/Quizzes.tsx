import { useEffect, useState } from "react";
import {
  BarChart3,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  HelpCircle,
  ListChecks,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { QuizBuilderDialog } from "@/components/quiz/QuizBuilderDialog";
import { QuizPlayerDialog } from "@/components/quiz/QuizPlayerDialog";
import { QuizResultsDialog } from "@/components/quiz/QuizResultsDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SyncStatus } from "@/components/shared/SyncStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRole } from "@/context/RoleContext";
import type { AcademicQuiz, QuizAvailability } from "@/data/academicPlatform";
import {
  ACADEMIC_QUIZZES_QUERY_KEY,
  useAcademicCourses,
  useAcademicQuizzes,
  useQuizDetail,
  useQuizResults,
} from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";
import { availabilityAt, formatDistance, formatMoment } from "@/lib/quizSchedule";
import { cn } from "@/lib/utils";

const statusTone: Record<string, string> = {
  available: "bg-success/10 text-success border-success/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  draft: "bg-muted text-muted-foreground border-border",
  closed: "bg-warning/10 text-warning border-warning/20",
  scheduled: "bg-info/10 text-info border-info/20",
};

/**
 * Ticks once a second while any quiz is waiting on its schedule, so a card can cross its
 * opening time and become takeable on its own. Idle - and re-rendering nothing - otherwise.
 */
function useClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export default function Quizzes() {
  const { canTeach } = useRole();
  const queryClient = useQueryClient();
  const { data: quizzes = [], isFetching, dataUpdatedAt } = useAcademicQuizzes();
  const { data: courses = [] } = useAcademicCourses();

  // Only one of these is ever set: whichever dialog is open drives its own detail fetch.
  const [builderQuizId, setBuilderQuizId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [playerQuizId, setPlayerQuizId] = useState<string | null>(null);
  const [resultsQuizId, setResultsQuizId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AcademicQuiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: builderDetail, isFetching: builderLoading } = useQuizDetail(builderOpen ? builderQuizId : null);
  const { data: playerDetail, isFetching: playerLoading } = useQuizDetail(playerQuizId);
  const { data: results, isFetching: resultsLoading } = useQuizResults(resultsQuizId);

  const isTeacher = canTeach;
  // The list renders placeholder demo rows (ids like "q1") until the first real response lands;
  // acting on those hits the API with a non-numeric id, so actions stay disabled until then.
  const quizzesLoaded = dataUpdatedAt > 0;
  const isRealQuiz = (quiz: AcademicQuiz) => quizzesLoaded && /^\d+$/.test(quiz.id);

  // Only run a clock if something is actually waiting on one.
  const hasSchedule = quizzes.some((quiz) => quiz.opensAt || quiz.closesAt);
  const now = useClock(hasSchedule);

  const available = quizzes.filter((quiz) => quiz.status === "available").length;
  const completed = quizzes.filter((quiz) => quiz.status === "completed").length;
  const questionTotal = quizzes.reduce((total, quiz) => total + quiz.questions, 0);

  const refreshQuizzes = () => queryClient.invalidateQueries({ queryKey: ACADEMIC_QUIZZES_QUERY_KEY });

  const openBuilder = (quizId: string | null) => {
    if (quizId === null && !courses.length) {
      toast.error("Create a course first.");
      return;
    }
    setBuilderQuizId(quizId);
    setBuilderOpen(true);
  };

  const guardAction = (quiz: AcademicQuiz, action: () => void) => {
    if (!isRealQuiz(quiz)) {
      toast.error("This quiz hasn't loaded yet. Try again in a moment.");
      return;
    }
    action();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/academic/quizzes/${pendingDelete.id}`, { method: "DELETE" });
      await refreshQuizzes();
      toast.success("Quiz deleted");
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the quiz");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Online assessment"
        title={isTeacher ? "Quiz and exam builder" : "Quizzes and exams"}
        description={
          isTeacher
            ? "Write multiple-choice and true/false questions, mark the answer key, and let submissions grade themselves."
            : "Take available quizzes, watch the time limit, and review your answers straight after submitting."
        }
        actions={
          isTeacher ? (
            <Button size="sm" variant="secondary" className="font-semibold" onClick={() => openBuilder(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New quiz
            </Button>
          ) : undefined
        }
      />

      {isFetching && <SyncStatus label="quizzes" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available" value={available} hint="Ready to take" icon={Brain} tone="success" />
        <StatCard label="Completed" value={completed} hint="Results recorded" icon={CheckCircle2} tone="primary" />
        <StatCard label="Questions" value={questionTotal} hint="Across assessments" icon={HelpCircle} tone="info" />
        <StatCard label="Auto grading" value="On" hint="MCQ and true/false" icon={ListChecks} tone="warning" />
      </div>

      {quizzes.length === 0 && !isFetching && (
        <EmptyState
          icon={Brain}
          title="No quizzes yet"
          detail={isTeacher ? "Create one to get started." : "Quizzes will appear here once your teacher publishes them."}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {quizzes.map((quiz, index) => {
          // Recomputed against the ticking clock rather than trusting the value fetched
          // earlier, so a quiz whose opening time passes while this page is open unlocks itself.
          const live = availabilityAt(quiz.publishStatus, quiz.opensAt, quiz.closesAt, now);
          const takeable = live === "available";
          const badgeStatus = isTeacher ? live : quiz.status === "completed" ? "completed" : live;
          const outOf = quiz.maxScore || quiz.questions;
          const hasAttempt = quiz.score !== undefined;
          return (
            <Card
              key={quiz.id}
              style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}
              className="flex min-h-[320px] animate-fade-in flex-col border-border/60 p-5 shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge variant="outline">{quiz.courseCode}</Badge>
                  <h2 className="mt-3 font-display text-xl font-bold text-foreground">{quiz.title}</h2>
                  {quiz.createdByName && (
                    <p className="mt-1 text-xs text-muted-foreground">Created by {quiz.createdByName}</p>
                  )}
                </div>
                <Badge className={cn("border shrink-0", statusTone[badgeStatus] ?? statusTone.draft)}>
                  {badgeStatus}
                </Badge>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniPanel icon={HelpCircle} label="Questions" value={quiz.questions} />
                <MiniPanel icon={Clock3} label="Time" value={`${quiz.timeLimit} min`} />
                {isTeacher ? (
                  <>
                    <MiniPanel icon={Trophy} label="Average" value={quiz.attemptCount ? `${quiz.averageScore}/${outOf}` : "-"} />
                    <MiniPanel icon={BarChart3} label="Attempts" value={quiz.attemptCount ?? 0} />
                  </>
                ) : (
                  <>
                    <MiniPanel icon={Trophy} label="Average" value={quiz.averageScore ? `${quiz.averageScore}/${outOf}` : "-"} />
                    <MiniPanel
                      icon={CheckCircle2}
                      label="Your score"
                      value={quiz.score === undefined ? "Not taken" : `${quiz.score}/${outOf}`}
                    />
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {quiz.questionTypes.map((type) => (
                  <Badge key={type} variant="secondary">
                    {type}
                  </Badge>
                ))}
              </div>

              <ScheduleLine quiz={quiz} live={live} now={now} />

              <div className="mt-auto pt-4">
                {isTeacher ? (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => guardAction(quiz, () => openBuilder(quiz.id))}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-primary text-primary-foreground"
                      onClick={() => guardAction(quiz, () => setResultsQuizId(quiz.id))}
                    >
                      <BarChart3 className="mr-2 h-4 w-4" /> Results
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete quiz"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => guardAction(quiz, () => setPendingDelete(quiz))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-gradient-primary text-primary-foreground"
                    // A finished attempt stays reviewable however the schedule has moved on.
                    disabled={!quizzesLoaded || (!takeable && !hasAttempt)}
                    onClick={() => guardAction(quiz, () => setPlayerQuizId(quiz.id))}
                  >
                    {!quizzesLoaded ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </>
                    ) : hasAttempt ? (
                      <>
                        <Eye className="mr-2 h-4 w-4" /> Review answers
                      </>
                    ) : live === "scheduled" ? (
                      <>
                        <CalendarClock className="mr-2 h-4 w-4" /> Opens in {formatDistance(Date.parse(quiz.opensAt!) - now)}
                      </>
                    ) : live === "closed" ? (
                      "Closed"
                    ) : live === "draft" ? (
                      "Not open yet"
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" /> Take quiz
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <QuizBuilderDialog
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open);
          if (!open) setBuilderQuizId(null);
        }}
        detail={builderQuizId ? builderDetail ?? null : null}
        isLoadingDetail={Boolean(builderQuizId) && builderLoading && !builderDetail}
        courses={courses}
        onSaved={refreshQuizzes}
      />

      <QuizPlayerDialog
        open={Boolean(playerQuizId)}
        onOpenChange={(open) => !open && setPlayerQuizId(null)}
        detail={playerDetail ?? null}
        isLoadingDetail={playerLoading && !playerDetail}
        onSubmitted={refreshQuizzes}
      />

      <QuizResultsDialog
        open={Boolean(resultsQuizId)}
        onOpenChange={(open) => !open && setResultsQuizId(null)}
        results={results ?? null}
        isLoading={resultsLoading && !results}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the quiz, its questions, and
              {pendingDelete?.attemptCount
                ? ` all ${pendingDelete.attemptCount} student ${pendingDelete.attemptCount === 1 ? "attempt" : "attempts"}`
                : " any attempts"}
              . It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete quiz"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The one-line summary of where a quiz sits in its window, or nothing if it has none. */
function ScheduleLine({ quiz, live, now }: { quiz: AcademicQuiz; live: QuizAvailability; now: number }) {
  if (!quiz.opensAt && !quiz.closesAt) return null;

  const opensIn = quiz.opensAt ? Date.parse(quiz.opensAt) - now : null;
  const closesIn = quiz.closesAt ? Date.parse(quiz.closesAt) - now : null;

  const [text, tone] =
    live === "scheduled" && opensIn !== null
      ? [`Opens in ${formatDistance(opensIn)} - ${formatMoment(quiz.opensAt)}`, "text-info"]
      : live === "closed" && closesIn !== null && closesIn <= 0
        ? [`Closed ${formatMoment(quiz.closesAt)}`, "text-muted-foreground"]
        : closesIn !== null && closesIn > 0
          ? [`Closes in ${formatDistance(closesIn)} - ${formatMoment(quiz.closesAt)}`, "text-warning"]
          : quiz.opensAt
            ? [`Opened ${formatMoment(quiz.opensAt)}`, "text-muted-foreground"]
            : ["", ""];

  if (!text) return null;

  return (
    <p className={cn("mt-3 flex items-center gap-1.5 text-xs font-medium", tone)}>
      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{text}</span>
    </p>
  );
}

function MiniPanel({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HelpCircle;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
