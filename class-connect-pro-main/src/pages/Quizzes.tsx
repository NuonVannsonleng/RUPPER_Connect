import { Brain, CheckCircle2, Clock3, HelpCircle, ListChecks, Plus, Trophy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRole } from "@/context/RoleContext";
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

      {isFetching && (
        <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Syncing quizzes with backend...
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available" value={available} hint="Ready to take" icon={Brain} tone="success" />
        <StatCard label="Completed" value={completed} hint="Results recorded" icon={CheckCircle2} tone="primary" />
        <StatCard label="Questions" value={questionTotal} hint="Across assessments" icon={HelpCircle} tone="info" />
        <StatCard label="Auto grading" value="On" hint="MCQ and true/false" icon={ListChecks} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="flex min-h-[320px] flex-col border-border/60 p-5 shadow-soft">
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

            <Button className="mt-auto w-full bg-gradient-primary text-primary-foreground" onClick={() => (isTeacher ? toast.success("Quiz editor opened.") : submitQuiz(quiz.id))}>
              {isTeacher ? "Edit quiz" : quiz.status === "completed" ? "View results" : "Take quiz"}
            </Button>
          </Card>
        ))}
      </div>
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
