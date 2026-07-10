import { CheckCircle2, Clock, FileUp, MessageSquareText, Plus, Star, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRole } from "@/context/RoleContext";
import {
  ACADEMIC_ASSIGNMENTS_QUERY_KEY,
  useAcademicAssignments,
  useAcademicCourses,
} from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";

const assignmentTone = {
  submitted: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  missing: "bg-destructive/10 text-destructive border-destructive/20",
  graded: "bg-primary/10 text-primary border-primary/20",
  late: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Assignments() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: assignments = [], isFetching } = useAcademicAssignments();
  const { data: courses = [] } = useAcademicCourses();
  const isTeacher = role === "teacher";
  const pending = assignments.filter((item) => item.status === "pending").length;
  const submitted = assignments.filter((item) => item.status === "submitted" || item.status === "graded").length;
  const missing = assignments.filter((item) => item.status === "missing").length;
  const completion = assignments.length ? Math.round((submitted / assignments.length) * 100) : 0;

  const refreshAssignments = () => queryClient.invalidateQueries({ queryKey: ACADEMIC_ASSIGNMENTS_QUERY_KEY });

  const createAssignment = async () => {
    const firstCourse = courses[0];
    if (!firstCourse) {
      toast.error("Create a course first.");
      return;
    }

    try {
      await apiRequest<{ message: string }>("/academic/assignments", {
        method: "POST",
        body: JSON.stringify({
          courseId: firstCourse.id,
          title: "New backend assignment",
          description: "Assignment created from RUPPER Connect.",
          deadline: "2026-08-01 23:59:00",
          maxScore: 100,
        }),
      });
      await refreshAssignments();
      toast.success("Assignment created in backend");
    } catch {
      toast.error("Could not create assignment");
    }
  };

  const submitAssignment = async (assignmentId: string) => {
    try {
      await apiRequest<{ message: string }>(`/academic/assignments/${assignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ fileUrl: "student-submission-placeholder.pdf" }),
      });
      await refreshAssignments();
      toast.success("Submission saved to backend");
    } catch {
      toast.error("Could not submit assignment");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Assessment workflow"
        title={isTeacher ? "Assignment management" : "My assignments"}
        description={
          isTeacher
            ? "Create assignments, set deadlines, review submissions, score work, and leave useful feedback."
            : "Submit work, track due dates, check grades, and read teacher feedback."
        }
        actions={
          isTeacher ? (
            <Button size="sm" variant="secondary" className="font-semibold" onClick={createAssignment}>
              <Plus className="mr-2 h-4 w-4" />
              Create assignment
            </Button>
          ) : undefined
        }
      />

      {isFetching && (
        <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Syncing assignments with backend...
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={isTeacher ? "Submissions" : "Submitted"} value={submitted} hint="Ready for review" icon={CheckCircle2} tone="success" />
        <StatCard label="Pending" value={pending} hint="Upcoming deadlines" icon={Clock} tone="warning" />
        <StatCard label="Missing" value={missing} hint="Needs attention" icon={XCircle} tone="warning" />
        <StatCard label="Completion" value={`${completion}%`} hint="Across assignments" icon={Star} tone="primary" />
      </div>

      <div className="grid gap-4">
        {assignments.map((assignment) => {
          const progress = Math.min(100, Math.round((assignment.submissionCount / 32) * 100));

          return (
            <Card key={assignment.id} className="border-border/60 p-5 shadow-soft sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{assignment.courseCode}</Badge>
                    <Badge className={`border ${assignmentTone[assignment.status]}`}>{assignment.status}</Badge>
                    <Badge variant="secondary">Max {assignment.maxScore} pts</Badge>
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground">{assignment.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Deadline: {assignment.deadline}</p>

                  {assignment.feedback && (
                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
                        <MessageSquareText className="h-4 w-4" />
                        Teacher feedback
                      </div>
                      <p className="text-sm leading-6 text-foreground">{assignment.feedback}</p>
                    </div>
                  )}
                </div>

                <div className="w-full rounded-xl border border-border/70 bg-secondary/30 p-4 lg:w-80">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>{isTeacher ? "Class submissions" : "Submission progress"}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <MiniMetric label="Submitted" value={assignment.submissionCount} />
                    <MiniMetric label="Score" value={assignment.score ? `${assignment.score}/${assignment.maxScore}` : "Pending"} />
                  </div>
                  <Button className="mt-4 w-full bg-gradient-primary text-primary-foreground" onClick={() => (isTeacher ? toast.success("Review queue opened.") : submitAssignment(assignment.id))}>
                    <FileUp className="mr-2 h-4 w-4" />
                    {isTeacher ? "Review submissions" : "Submit file"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-card px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}
