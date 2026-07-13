import { useState } from "react";
import { Brain, CheckCircle2, Clock3, HelpCircle, ListChecks, Plus, Trophy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SyncStatus } from "@/components/shared/SyncStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/context/RoleContext";
import type { AcademicQuiz } from "@/data/academicPlatform";
import {
  ACADEMIC_QUIZZES_QUERY_KEY,
  useAcademicCourses,
  useAcademicQuizzes,
} from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";

const statusTone = {
  available: "bg-success/10 text-success border-success/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  draft: "bg-muted text-muted-foreground border-border",
};

export default function Quizzes() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: quizzes = [], isFetching } = useAcademicQuizzes();
  const { data: courses = [] } = useAcademicCourses();
  const [viewingQuiz, setViewingQuiz] = useState<AcademicQuiz | null>(null);
  const isTeacher = role === "teacher";
  const available = quizzes.filter((quiz) => quiz.status === "available").length;
  const completed = quizzes.filter((quiz) => quiz.status === "completed").length;
  const questionTotal = quizzes.reduce((total, quiz) => total + quiz.questions, 0);

  const refreshQuizzes = () => queryClient.invalidateQueries({ queryKey: ACADEMIC_QUIZZES_QUERY_KEY });

  const createQuiz = async () => {
    const firstCourse = courses[0];
    if (!firstCourse) {
      toast.error("Create a course first.");
      return;
    }

    try {
      await apiRequest<{ message: string }>("/academic/quizzes", {
        method: "POST",
        body: JSON.stringify({
          courseId: firstCourse.id,
          title: "New backend quiz",
          description: "Auto-graded quiz created from RUPPER Connect.",
          timeLimit: 20,
          status: "available",
        }),
      });
      await refreshQuizzes();
      toast.success("Quiz created in backend");
    } catch {
      toast.error("Could not create quiz");
    }
  };

  const submitQuiz = async (quizId: string) => {
    try {
      await apiRequest<{ message: string }>(`/academic/quizzes/${quizId}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers: { sample: "A" } }),
      });
      await refreshQuizzes();
      toast.success("Quiz attempt submitted");
    } catch {
      toast.error("Could not submit quiz");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Online assessment"
        title={isTeacher ? "Quiz and exam builder" : "Quizzes and exams"}
        description={
          isTeacher
            ? "Create MCQ and true/false quizzes, set time limits, and use auto grading for faster feedback."
            : "Take available quizzes, watch the time limit, and review your results after submission."
        }
        actions={
          isTeacher ? (
            <Button size="sm" variant="secondary" className="font-semibold" onClick={createQuiz}>
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
        <EmptyState icon={Brain} title="No quizzes yet" detail="Quizzes and exams will appear here once created." />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {quizzes.map((quiz) => (
          <Card
            key={quiz.id}
            className="flex min-h-[320px] flex-col border-border/60 p-5 shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">{quiz.courseCode}</Badge>
                <h2 className="mt-3 font-display text-xl font-bold text-foreground">{quiz.title}</h2>
              </div>
              <Badge className={`border ${statusTone[quiz.status]}`}>{quiz.status}</Badge>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniPanel icon={HelpCircle} label="Questions" value={quiz.questions} />
              <MiniPanel icon={Clock3} label="Time" value={`${quiz.timeLimit} min`} />
              <MiniPanel icon={Trophy} label="Average" value={quiz.averageScore ? `${quiz.averageScore}/${quiz.questions}` : "Draft"} />
              <MiniPanel icon={CheckCircle2} label="Your score" value={quiz.score ? `${quiz.score}/${quiz.questions}` : "Not taken"} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {quiz.questionTypes.map((type) => (
                <Badge key={type} variant="secondary">
                  {type}
                </Badge>
              ))}
            </div>

            <Button className="mt-auto w-full bg-gradient-primary text-primary-foreground" onClick={() => (isTeacher ? setViewingQuiz(quiz) : submitQuiz(quiz.id))}>
              {isTeacher ? "View results" : quiz.status === "completed" ? "View results" : "Take quiz"}
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(viewingQuiz)} onOpenChange={(open) => !open && setViewingQuiz(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewingQuiz?.title}</DialogTitle>
          </DialogHeader>
          {viewingQuiz && (
            <div className="space-y-3 pt-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2">
                <span className="text-muted-foreground">Course</span>
                <span className="font-semibold text-foreground">{viewingQuiz.courseCode}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`border ${statusTone[viewingQuiz.status]}`}>{viewingQuiz.status}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2">
                <span className="text-muted-foreground">Questions</span>
                <span className="font-semibold text-foreground">{viewingQuiz.questions}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2">
                <span className="text-muted-foreground">Time limit</span>
                <span className="font-semibold text-foreground">{viewingQuiz.timeLimit} min</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2">
                <span className="text-muted-foreground">Class average</span>
                <span className="font-semibold text-foreground">
                  {viewingQuiz.averageScore ? `${viewingQuiz.averageScore}/${viewingQuiz.questions}` : "No attempts yet"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Editing quiz questions from the dashboard isn't available yet - question sets can be updated directly
                on the backend for now.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
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
