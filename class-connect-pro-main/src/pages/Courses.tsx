import { useState } from "react";
import {
  BookOpenCheck,
  ClipboardCheck,
  Download,
  FileText,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  Plus,
  Upload,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyncStatus } from "@/components/shared/SyncStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/context/RoleContext";
import type { AcademicMaterial } from "@/data/academicPlatform";
import { ACADEMIC_COURSES_QUERY_KEY, useAcademicCourses } from "@/hooks/useAcademicPlatform";
import { apiRequest, buildApiUrl, getToken } from "@/lib/api";

const statusTone = {
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  "at-risk": "bg-destructive/10 text-destructive border-destructive/20",
};

const MAX_MATERIAL_BYTES = 8 * 1024 * 1024;

const emptyCourseForm = {
  code: "",
  title: "",
  faculty: "",
  department: "",
  credits: "3",
  semester: "",
  room: "",
  schedule: "",
  description: "",
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

export default function Courses() {
  const { role } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: courses = [], isFetching } = useAcademicCourses();
  const isTeacher = role === "teacher";

  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  const [materialCourseId, setMaterialCourseId] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState<"PDF" | "Slides" | "Video" | "Link">("PDF");
  const [materialLink, setMaterialLink] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);

  const resetCourseForm = () => setCourseForm(emptyCourseForm);

  const handleCreateCourse = async () => {
    if (!courseForm.code.trim() || !courseForm.title.trim()) {
      toast.error("Course code and title are required.");
      return;
    }

    setIsCreatingCourse(true);
    try {
      await apiRequest<{ message: string }>("/academic/courses", {
        method: "POST",
        body: JSON.stringify({
          ...courseForm,
          code: courseForm.code.trim().toUpperCase(),
          title: courseForm.title.trim(),
          credits: Number(courseForm.credits) || 3,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_COURSES_QUERY_KEY });
      toast.success("Course created");
      setCourseDialogOpen(false);
      resetCourseForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create course");
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const openMaterialDialog = (courseId: string) => {
    setMaterialCourseId(courseId);
    setMaterialTitle("");
    setMaterialType("PDF");
    setMaterialLink("");
    setMaterialFile(null);
  };

  const handleUploadMaterial = async () => {
    if (!materialCourseId) return;
    if (!materialTitle.trim()) {
      toast.error("Give the material a title.");
      return;
    }
    if (materialType === "Link" && !materialLink.trim()) {
      toast.error("Add a link URL.");
      return;
    }
    if (materialType !== "Link" && !materialFile) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (materialFile && materialFile.size > MAX_MATERIAL_BYTES) {
      toast.error("File is too large. Maximum size is 8MB.");
      return;
    }

    setIsUploadingMaterial(true);
    try {
      const payload: Record<string, unknown> = { title: materialTitle.trim(), type: materialType };
      if (materialType === "Link") {
        payload.fileUrl = materialLink.trim();
      } else if (materialFile) {
        payload.fileName = materialFile.name;
        payload.fileMime = materialFile.type || "application/octet-stream";
        payload.fileData = await readFileAsBase64(materialFile);
      }

      await apiRequest<{ message: string }>(`/academic/courses/${materialCourseId}/materials`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_COURSES_QUERY_KEY });
      toast.success("Material uploaded");
      setMaterialCourseId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload material");
    } finally {
      setIsUploadingMaterial(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Academic module"
        title={isTeacher ? "Course management" : "My courses"}
        description={
          isTeacher
            ? "Manage course materials, assignments, quizzes, discussions, attendance, grades, and student progress."
            : "Access learning materials, assignments, quizzes, discussions, attendance, and course grades in one place."
        }
        actions={
          isTeacher ? (
            <Button size="sm" variant="secondary" className="font-semibold" onClick={() => setCourseDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New course
            </Button>
          ) : undefined
        }
      />

      {isFetching && <SyncStatus label="course data" />}

      {courses.length === 0 && !isFetching && (
        <EmptyState
          icon={BookOpenCheck}
          title="No courses yet"
          detail={isTeacher ? "Create your first course to get started." : "Enrolled courses will appear here."}
        />
      )}

      <div className="grid gap-5">
        {courses.map((course) => (
          <Card key={course.id} className="overflow-hidden border-border/60 shadow-soft">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {course.code}
                      </Badge>
                      <Badge className={`rounded-full border ${statusTone[course.status]}`}>
                        {course.status}
                      </Badge>
                    </div>
                    <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">{course.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{course.description}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm">
                    <p className="font-semibold text-foreground">{course.lecturer}</p>
                    <p className="text-xs text-muted-foreground">{course.lecturerEmail}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Credits" value={course.credits} />
                  <Metric label="Attendance" value={`${course.attendance}%`} />
                  <Metric label="Grade" value={`${course.grade}%`} />
                  <Metric label="Progress" value={`${course.progress}%`} />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>Course progress</span>
                    <span>{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <InfoLine label="Faculty" value={course.faculty} />
                  <InfoLine label="Department" value={course.department} />
                  <InfoLine label="Schedule" value={course.schedule} />
                  <InfoLine label="Room" value={course.room} />
                </div>
              </div>

              <div className="border-t border-border/60 bg-secondary/30 p-5 sm:p-6 lg:border-l lg:border-t-0">
                <Tabs defaultValue="materials" className="w-full">
                  <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="materials">Materials</TabsTrigger>
                    <TabsTrigger value="assignments">Work</TabsTrigger>
                    <TabsTrigger value="quiz">Quiz</TabsTrigger>
                  </TabsList>

                  <TabsContent value="materials" className="mt-4 space-y-3">
                    {course.materials.length === 0 && (
                      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        No materials uploaded yet.
                      </p>
                    )}
                    {course.materials.map((material) => (
                      <MaterialRow key={material.id} material={material} />
                    ))}
                    {isTeacher && (
                      <Button variant="outline" className="w-full" onClick={() => openMaterialDialog(course.id)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload material
                      </Button>
                    )}
                  </TabsContent>

                  <TabsContent value="assignments" className="mt-4 space-y-3">
                    {course.assignments.map((assignment) => (
                      <ActionRow
                        key={assignment.id}
                        icon={ClipboardCheck}
                        title={assignment.title}
                        meta={`Due ${assignment.deadline} - ${assignment.submissionCount} submissions`}
                      />
                    ))}
                    <Button variant="outline" className="w-full" onClick={() => navigate("/assignments")}>
                      {isTeacher ? "Create assignment" : "Submit assignment"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="quiz" className="mt-4 space-y-3">
                    {course.quizzes.map((quiz) => (
                      <ActionRow key={quiz.id} icon={BookOpenCheck} title={quiz.title} meta={`${quiz.questions} questions - ${quiz.timeLimit} minutes`} />
                    ))}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button variant="outline" onClick={() => navigate("/quizzes")}>
                        {isTeacher ? "Manage quizzes" : "Take quiz"}
                      </Button>
                      <Button variant="ghost" onClick={() => navigate("/messages")}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Discussion
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                {isTeacher && (
                  <Button className="mt-4 w-full bg-gradient-primary text-primary-foreground" onClick={() => navigate("/gradebook")}>
                    <Users className="mr-2 h-4 w-4" />
                    View student progress
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={courseDialogOpen}
        onOpenChange={(open) => {
          setCourseDialogOpen(open);
          if (!open) resetCourseForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create a new course</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label htmlFor="course-code">Course code</Label>
              <Input
                id="course-code"
                value={courseForm.code}
                onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="CS401"
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="course-credits">Credits</Label>
              <Input
                id="course-credits"
                type="number"
                min={1}
                max={10}
                value={courseForm.credits}
                onChange={(e) => setCourseForm((f) => ({ ...f, credits: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="course-title">Title</Label>
              <Input
                id="course-title"
                value={courseForm.title}
                onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Distributed Systems"
              />
            </div>
            <div>
              <Label htmlFor="course-faculty">Faculty</Label>
              <Input
                id="course-faculty"
                value={courseForm.faculty}
                onChange={(e) => setCourseForm((f) => ({ ...f, faculty: e.target.value }))}
                placeholder="Faculty of Engineering"
              />
            </div>
            <div>
              <Label htmlFor="course-department">Department</Label>
              <Input
                id="course-department"
                value={courseForm.department}
                onChange={(e) => setCourseForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Information Technology Engineering"
              />
            </div>
            <div>
              <Label htmlFor="course-semester">Semester</Label>
              <Input
                id="course-semester"
                value={courseForm.semester}
                onChange={(e) => setCourseForm((f) => ({ ...f, semester: e.target.value }))}
                placeholder="Year 2 - Semester 2"
              />
            </div>
            <div>
              <Label htmlFor="course-room">Room</Label>
              <Input
                id="course-room"
                value={courseForm.room}
                onChange={(e) => setCourseForm((f) => ({ ...f, room: e.target.value }))}
                placeholder="Lab 204"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="course-schedule">Schedule</Label>
              <Input
                id="course-schedule"
                value={courseForm.schedule}
                onChange={(e) => setCourseForm((f) => ({ ...f, schedule: e.target.value }))}
                placeholder="Monday 08:00 - 09:30"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="course-description">Description</Label>
              <Input
                id="course-description"
                value={courseForm.description}
                onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What this course covers..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCourseDialogOpen(false)} disabled={isCreatingCourse}>
              Cancel
            </Button>
            <Button onClick={handleCreateCourse} className="bg-gradient-primary text-primary-foreground" disabled={isCreatingCourse}>
              {isCreatingCourse ? "Creating..." : "Create course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(materialCourseId)} onOpenChange={(open) => !open && setMaterialCourseId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload course material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="material-title">Title</Label>
              <Input
                id="material-title"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                placeholder="Week 3 lecture slides"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={materialType} onValueChange={(value) => setMaterialType(value as typeof materialType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="Slides">Slides</SelectItem>
                  <SelectItem value="Video">Video</SelectItem>
                  <SelectItem value="Link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {materialType === "Link" ? (
              <div>
                <Label htmlFor="material-link">Link URL</Label>
                <Input
                  id="material-link"
                  value={materialLink}
                  onChange={(e) => setMaterialLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="material-file">File</Label>
                <Input
                  id="material-file"
                  type="file"
                  onChange={(e) => setMaterialFile(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {materialFile ? `${materialFile.name} - ${formatBytes(materialFile.size)}` : "Maximum size 8MB. Saved directly to the database."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMaterialCourseId(null)} disabled={isUploadingMaterial}>
              Cancel
            </Button>
            <Button onClick={handleUploadMaterial} className="bg-gradient-primary text-primary-foreground" disabled={isUploadingMaterial}>
              {isUploadingMaterial ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/70 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  meta,
}: {
  icon: typeof FileText;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

async function downloadMaterialFile(material: AcademicMaterial) {
  if (!material.downloadUrl) return;
  try {
    const res = await fetch(buildApiUrl(material.downloadUrl), {
      headers: { Authorization: `Bearer ${getToken() || ""}` },
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = material.fileName || material.title;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Could not download this file");
  }
}

function MaterialRow({ material }: { material: AcademicMaterial }) {
  const meta = [material.type, material.uploadedAt, formatBytes(material.fileSize)].filter(Boolean).join(" - ");
  const isLink = material.type === "Link" && material.fileUrl;
  const isDownloadable = Boolean(material.downloadUrl);
  const Icon = material.type === "Link" ? LinkIcon : FileText;

  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{material.title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {(isLink || isDownloadable) && <Download className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );

  const className = `flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-base ${
    isLink || isDownloadable ? "hover:border-primary/40 hover:bg-secondary/30" : "cursor-default opacity-80"
  }`;

  if (isLink) {
    return (
      <a href={material.fileUrl} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  if (isDownloadable) {
    return (
      <button type="button" onClick={() => downloadMaterialFile(material)} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
