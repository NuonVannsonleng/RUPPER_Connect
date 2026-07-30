import { useState } from "react";
import { CheckCircle2, Clock, Download, FileUp, Loader2, MessageSquareText, Plus, Star, XCircle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/context/RoleContext";
import type { AcademicAssignment } from "@/data/academicPlatform";
import {
  ACADEMIC_ASSIGNMENTS_QUERY_KEY,
  useAcademicAssignments,
  useAcademicCourses,
} from "@/hooks/useAcademicPlatform";
import { apiRequest, buildApiUrl, getToken } from "@/lib/api";

interface AssignmentSubmission {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  status: string;
  score?: number;
  feedback?: string;
  submittedAt?: string;
  gradedByName?: string;
}

const assignmentTone = {
  submitted: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  missing: "bg-destructive/10 text-destructive border-destructive/20",
  graded: "bg-primary/10 text-primary border-primary/20",
  late: "bg-destructive/10 text-destructive border-destructive/20",
};

// Keep in sync with the 15MB / extension allow-list enforced server-side in
// rupper-backend/controllers/academicController.js.
const MAX_SUBMISSION_BYTES = 15 * 1024 * 1024;
const ALLOWED_SUBMISSION_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv",
  "zip", "rar", "7z", "png", "jpg", "jpeg", "gif",
  "py", "js", "ts", "java", "c", "cpp", "h", "cs", "rb", "go", "php", "html", "css", "json",
]);

const validateSubmissionFile = (file: File): string | null => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_SUBMISSION_EXTENSIONS.has(extension)) {
    return "That file type isn't supported. Upload a document, spreadsheet, presentation, image, archive, or common source-code file.";
  }
  if (file.size > MAX_SUBMISSION_BYTES) {
    return "File is too large. Maximum size is 15MB.";
  }
  return null;
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const formatBytes = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

async function downloadSubmissionFile(downloadUrl: string, fileName?: string) {
  try {
    const res = await fetch(buildApiUrl(downloadUrl), {
      headers: { Authorization: `Bearer ${getToken() || ""}` },
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "submission";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Could not download this file");
  }
}

export default function Assignments() {
  const { canTeach } = useRole();
  const queryClient = useQueryClient();
  const { data: assignments = [], isFetching } = useAcademicAssignments();
  const { data: courses = [] } = useAcademicCourses();
  const [reviewingAssignment, setReviewingAssignment] = useState<AcademicAssignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<Record<string, File | undefined>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ courseId: "", title: "", description: "", deadline: "", maxScore: "100" });
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const isTeacher = canTeach;
  const pending = assignments.filter((item) => item.status === "pending").length;
  const submitted = assignments.filter((item) => item.status === "submitted" || item.status === "graded").length;
  const missing = assignments.filter((item) => item.status === "missing").length;
  const completion = assignments.length ? Math.round((submitted / assignments.length) * 100) : 0;

  const refreshAssignments = () => queryClient.invalidateQueries({ queryKey: ACADEMIC_ASSIGNMENTS_QUERY_KEY });

  const openCreateDialog = () => {
    if (!courses.length) {
      toast.error("Create a course first.");
      return;
    }
    setNewAssignment({ courseId: courses[0].id, title: "", description: "", deadline: "", maxScore: "100" });
    setCreateDialogOpen(true);
  };

  const createAssignment = async () => {
    if (!newAssignment.courseId || !newAssignment.title.trim() || !newAssignment.deadline) {
      toast.error("Course, title, and deadline are required.");
      return;
    }

    setIsCreatingAssignment(true);
    try {
      await apiRequest<{ message: string }>("/academic/assignments", {
        method: "POST",
        body: JSON.stringify({
          courseId: newAssignment.courseId,
          title: newAssignment.title.trim(),
          description: newAssignment.description.trim(),
          deadline: newAssignment.deadline.replace("T", " ") + ":00",
          maxScore: Number(newAssignment.maxScore) || 100,
        }),
      });
      await refreshAssignments();
      toast.success("Assignment created");
      setCreateDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create assignment");
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleFileChange = (assignmentId: string, file: File | null) => {
    if (file) {
      const error = validateSubmissionFile(file);
      if (error) {
        toast.error(error);
        return;
      }
    }
    setPendingFile((current) => ({ ...current, [assignmentId]: file ?? undefined }));
  };

  const submitAssignment = async (assignmentId: string) => {
    const file = pendingFile[assignmentId];
    if (!file) {
      toast.error("Choose a file to submit first.");
      return;
    }

    setSubmittingId(assignmentId);
    try {
      const fileData = await readFileAsBase64(file);
      await apiRequest<{ message: string }>(`/academic/assignments/${assignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileMime: file.type || "application/octet-stream", fileData }),
      });
      setPendingFile((current) => ({ ...current, [assignmentId]: undefined }));
      await refreshAssignments();
      toast.success("Assignment submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit assignment");
    } finally {
      setSubmittingId(null);
    }
  };

  const openReview = async (assignment: AcademicAssignment) => {
    setReviewingAssignment(assignment);
    setLoadingSubmissions(true);
    try {
      const rows = await apiRequest<AssignmentSubmission[]>(`/academic/assignments/${assignment.id}/submissions`);
      setSubmissions(rows);
    } catch {
      setSubmissions([]);
      toast.error("Could not load submissions for this assignment");
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const updateSubmissionDraft = (submissionId: string, updates: Partial<AssignmentSubmission>) => {
    setSubmissions((current) => current.map((row) => (row.id === submissionId ? { ...row, ...updates } : row)));
  };

  const saveSubmissionGrade = async (submission: AssignmentSubmission) => {
    setSavingSubmissionId(submission.id);
    try {
      await apiRequest<{ message: string }>(`/academic/assignment-submissions/${submission.id}/grade`, {
        method: "PUT",
        body: JSON.stringify({ score: submission.score ?? 0, feedback: submission.feedback || "" }),
      });
      updateSubmissionDraft(submission.id, { status: "graded" });
      await refreshAssignments();
      toast.success(`Grade saved for ${submission.studentName}`);
    } catch {
      toast.error("Could not save this grade");
    } finally {
      setSavingSubmissionId(null);
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
            <Button size="sm" variant="secondary" className="font-semibold" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create assignment
            </Button>
          ) : undefined
        }
      />

      {isFetching && <SyncStatus label="assignments" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={isTeacher ? "Submissions" : "Submitted"} value={submitted} hint="Ready for review" icon={CheckCircle2} tone="success" />
        <StatCard label="Pending" value={pending} hint="Upcoming deadlines" icon={Clock} tone="warning" />
        <StatCard label="Missing" value={missing} hint="Needs attention" icon={XCircle} tone="warning" />
        <StatCard label="Completion" value={`${completion}%`} hint="Across assignments" icon={Star} tone="primary" />
      </div>

      {assignments.length === 0 && !isFetching && (
        <EmptyState icon={CheckCircle2} title="No assignments yet" detail="Created assignments will appear here." />
      )}

      <div className="grid gap-4">
        {assignments.map((assignment) => {
          const progress = Math.min(100, Math.round((assignment.submissionCount / 32) * 100));

          return (
            <Card
              key={assignment.id}
              className="border-border/60 p-5 shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant sm:p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{assignment.courseCode}</Badge>
                    <Badge className={`border ${assignmentTone[assignment.status]}`}>{assignment.status}</Badge>
                    <Badge variant="secondary">Max {assignment.maxScore} pts</Badge>
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground">{assignment.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Deadline: {assignment.deadline}
                    {assignment.createdByName ? ` - created by ${assignment.createdByName}` : ""}
                  </p>

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

                  {isTeacher ? (
                    <Button className="mt-4 w-full bg-gradient-primary text-primary-foreground" onClick={() => openReview(assignment)}>
                      <FileUp className="mr-2 h-4 w-4" />
                      Review submissions
                    </Button>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {assignment.submissionId && assignment.downloadUrl && (
                        <button
                          type="button"
                          onClick={() => downloadSubmissionFile(assignment.downloadUrl!, assignment.fileName)}
                          className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-xs transition-base hover:border-primary/40"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-foreground">{assignment.fileName || "Your submission"}</span>
                        </button>
                      )}
                      <Input
                        type="file"
                        onChange={(e) => handleFileChange(assignment.id, e.target.files?.[0] ?? null)}
                        disabled={submittingId === assignment.id}
                      />
                      <p className="truncate text-xs text-muted-foreground">
                        {pendingFile[assignment.id]
                          ? `${pendingFile[assignment.id]!.name} - ${formatBytes(pendingFile[assignment.id]!.size)}`
                          : "Max 15MB."}
                      </p>
                      <Button
                        className="w-full bg-gradient-primary text-primary-foreground"
                        onClick={() => submitAssignment(assignment.id)}
                        disabled={submittingId === assignment.id || !pendingFile[assignment.id]}
                      >
                        {submittingId === assignment.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                          </>
                        ) : (
                          <>
                            <FileUp className="mr-2 h-4 w-4" />
                            {assignment.submissionId ? "Resubmit" : "Submit file"}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Course</Label>
              <Select
                value={newAssignment.courseId}
                onValueChange={(value) => setNewAssignment((f) => ({ ...f, courseId: value }))}
              >
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
              <Label htmlFor="assignment-title">Title</Label>
              <Input
                id="assignment-title"
                value={newAssignment.title}
                onChange={(e) => setNewAssignment((f) => ({ ...f, title: e.target.value }))}
                placeholder="Homework 4 - Recursion"
              />
            </div>
            <div>
              <Label htmlFor="assignment-description">Description</Label>
              <Textarea
                id="assignment-description"
                value={newAssignment.description}
                onChange={(e) => setNewAssignment((f) => ({ ...f, description: e.target.value }))}
                placeholder="What should students submit?"
                className="min-h-[5rem]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="assignment-deadline">Deadline</Label>
                <Input
                  id="assignment-deadline"
                  type="datetime-local"
                  value={newAssignment.deadline}
                  onChange={(e) => setNewAssignment((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="assignment-max-score">Max score</Label>
                <Input
                  id="assignment-max-score"
                  type="number"
                  min={1}
                  value={newAssignment.maxScore}
                  onChange={(e) => setNewAssignment((f) => ({ ...f, maxScore: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} disabled={isCreatingAssignment}>
              Cancel
            </Button>
            <Button onClick={createAssignment} className="bg-gradient-primary text-primary-foreground" disabled={isCreatingAssignment}>
              {isCreatingAssignment ? "Creating..." : "Create assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewingAssignment)} onOpenChange={(open) => !open && setReviewingAssignment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reviewingAssignment?.title} - submissions</DialogTitle>
          </DialogHeader>

          {loadingSubmissions ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions...
            </div>
          ) : submissions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No students have submitted this assignment yet.</p>
          ) : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {submissions.map((submission) => (
                <div key={submission.id} className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{submission.studentName}</p>
                      <p className="text-xs text-muted-foreground">{submission.studentEmail}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`border ${assignmentTone[submission.status as keyof typeof assignmentTone] || ""}`}>
                        {submission.status}
                      </Badge>
                      {submission.gradedByName && (
                        <span className="text-[11px] text-muted-foreground">Graded by {submission.gradedByName}</span>
                      )}
                    </div>
                  </div>
                  {submission.downloadUrl ? (
                    <button
                      type="button"
                      onClick={() => downloadSubmissionFile(submission.downloadUrl!, submission.fileName)}
                      className="mb-3 flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-xs transition-base hover:border-primary/40"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-foreground">{submission.fileName}</span>
                      {submission.fileSize ? (
                        <span className="ml-auto shrink-0 text-muted-foreground">{formatBytes(submission.fileSize)}</span>
                      ) : null}
                    </button>
                  ) : (
                    <p className="mb-3 text-xs text-muted-foreground">No file was attached to this submission.</p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score</label>
                      <Input
                        type="number"
                        min={0}
                        max={reviewingAssignment?.maxScore ?? 100}
                        value={submission.score ?? ""}
                        onChange={(e) => updateSubmissionDraft(submission.id, { score: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedback</label>
                      <Textarea
                        value={submission.feedback ?? ""}
                        onChange={(e) => updateSubmissionDraft(submission.id, { feedback: e.target.value })}
                        className="mt-1 min-h-[4.5rem]"
                        placeholder="Leave feedback for this student..."
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 bg-gradient-primary text-primary-foreground"
                    disabled={savingSubmissionId === submission.id}
                    onClick={() => saveSubmissionGrade(submission)}
                  >
                    {savingSubmissionId === submission.id ? "Saving..." : "Save grade"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
