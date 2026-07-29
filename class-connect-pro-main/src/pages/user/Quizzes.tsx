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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newQuiz, setNewQuiz] = useState({ courseId: "", title: "", description: "", timeLimit: "20", status: "available" });
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const isTeacher = role === "teacher";
  const available = quizzes.filter((quiz) => quiz.status === "available").length;
  const completed = quizzes.filter((quiz) => quiz.status === "completed").length;
  const questionTotal = quizzes.reduce((total, quiz) => total + quiz.questions, 0);

  const refreshQuizzes = () => queryClient.invalidateQueries({ queryKey: ACADEMIC_QUIZZES_QUERY_KEY });

  const openCreateDialog = () => {
    if (!courses.length) {
      toast.error("Create a course first.");
      return;
    }
    setNewQuiz({ courseId: courses[0].id, title: "", description: "", timeLimit: "20", status: "available" });
    setCreateDialogOpen(true);
  };

  const createQuiz = async () => {
    if (!newQuiz.courseId || !newQuiz.title.trim()) {
      toast.error("Course and title are required.");
      return;
    }

    setIsCreatingQuiz(true);
    try {
      await apiRequest<{ message: string }>("/academic/quizzes", {
        method: "POST",
        body: JSON.stringify({
          courseId: newQuiz.courseId,
          title: newQuiz.title.trim(),
          description: newQuiz.description.trim(),
          timeLimit: Number(newQuiz.timeLimit) || 20,
          status: newQuiz.status,
        }),
      });
      await refreshQuizzes();
      toast.success("Quiz created");
      setCreateDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create quiz");
    } finally {
      setIsCreatingQuiz(false);
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
            <Button size="sm" variant="secondary" className="font-semibold" onClick={openCreateDialog}>
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Course</Label>
              <Select value={newQuiz.courseId} onValueChange={(value) => setNewQuiz((f) => ({ ...f, courseId: value }))}>
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
              <Label htmlFor="quiz-title">Title</Label>
              <Input
                id="quiz-title"
                value={newQuiz.title}
                onChange={(e) => setNewQuiz((f) => ({ ...f, title: e.target.value }))}
                placeholder="Chapter 4 Check"
              />
            </div>
            <div>
              <Label htmlFor="quiz-description">Description</Label>
              <Textarea
                id="quiz-description"
                value={newQuiz.description}
                onChange={(e) => setNewQuiz((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this quiz cover?"
                className="min-h-[5rem]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quiz-time-limit">Time limit (minutes)</Label>
                <Input
                  id="quiz-time-limit"
                  type="number"
                  min={1}
                  value={newQuiz.timeLimit}
                  onChange={(e) => setNewQuiz((f) => ({ ...f, timeLimit: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={newQuiz.status} onValueChange={(value) => setNewQuiz((f) => ({ ...f, status: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A sample MCQ and true/false question are added automatically - editing question sets isn't available
              from the dashboard yet.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} disabled={isCreatingQuiz}>
              Cancel
            </Button>
            <Button onClick={createQuiz} className="bg-gradient-primary text-primary-foreground" disabled={isCreatingQuiz}>
              {isCreatingQuiz ? "Creating..." : "Create quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
