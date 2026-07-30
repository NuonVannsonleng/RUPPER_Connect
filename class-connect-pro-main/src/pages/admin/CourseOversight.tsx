import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, BookOpenCheck, Loader2, Pencil, Plus, Search, Trash2, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMIN_COURSES_QUERY_KEY,
  useAdminCourses,
  useAdminUsers,
  type AdminCourse,
} from "@/hooks/useAdmin";
import { apiRequest } from "@/lib/api";

const UNASSIGNED = "unassigned";

interface CourseFormState {
  code: string;
  title: string;
  faculty: string;
  department: string;
  credits: string;
  semester: string;
  room: string;
  schedule: string;
  description: string;
  status: string;
}

const emptyCourseForm: CourseFormState = {
  code: "",
  title: "",
  faculty: "",
  department: "",
  credits: "3",
  semester: "",
  room: "",
  schedule: "",
  description: "",
  status: "active",
};

const formFromCourse = (course: AdminCourse): CourseFormState => ({
  code: course.code,
  title: course.title,
  faculty: course.faculty,
  department: course.department,
  credits: String(course.credits || 3),
  semester: course.semester,
  room: course.room,
  schedule: course.schedule,
  description: course.description,
  status: course.status,
});

export default function CourseOversight() {
  const queryClient = useQueryClient();
  const { data: courses = [], isFetching, isError, error, refetch } = useAdminCourses();
  const { data: users = [] } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyCourseForm);
  const [isSavingForm, setIsSavingForm] = useState(false);

  const [courseToDelete, setCourseToDelete] = useState<AdminCourse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const teachers = useMemo(() => users.filter((u) => u.role === "teacher" || u.role === "admin"), [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return courses;
    return courses.filter(
      (course) =>
        course.code.toLowerCase().includes(term) ||
        course.title.toLowerCase().includes(term) ||
        course.lecturerName.toLowerCase().includes(term)
    );
  }, [courses, search]);

  const unassigned = courses.filter((course) => !course.lecturerId).length;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_COURSES_QUERY_KEY });

  const assignLecturer = async (course: AdminCourse, lecturerId: string) => {
    setSavingId(course.id);
    try {
      await apiRequest<{ message: string }>(`/admin/courses/${course.id}/lecturer`, {
        method: "PUT",
        body: JSON.stringify({ lecturerId: lecturerId === UNASSIGNED ? null : lecturerId }),
      });
      await refresh();
      toast.success(
        lecturerId === UNASSIGNED
          ? `Cleared the lecturer for ${course.code}`
          : `Assigned ${teachers.find((t) => t.id === lecturerId)?.name ?? "teacher"} to ${course.code}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the lecturer");
    } finally {
      setSavingId(null);
    }
  };

  const openCreate = () => {
    setEditingCourse(null);
    setForm(emptyCourseForm);
    setFormOpen(true);
  };

  const openEdit = (course: AdminCourse) => {
    setEditingCourse(course);
    setForm(formFromCourse(course));
    setFormOpen(true);
  };

  const saveCourse = async () => {
    if (!form.code.trim() || !form.title.trim()) {
      toast.error("Course code and title are required.");
      return;
    }

    setIsSavingForm(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        faculty: form.faculty.trim(),
        department: form.department.trim(),
        credits: Number(form.credits) || 3,
        semester: form.semester.trim(),
        room: form.room.trim(),
        schedule: form.schedule.trim(),
        description: form.description.trim(),
        status: form.status,
      };

      if (editingCourse) {
        await apiRequest<{ message: string }>(`/admin/courses/${editingCourse.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        // Course creation itself isn't an admin-only concept - any teacher can already create
        // one - so this reuses that same endpoint rather than a second admin-only copy.
        await apiRequest<{ message: string }>("/academic/courses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await refresh();
      toast.success(editingCourse ? "Course updated" : "Course created");
      setFormOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : editingCourse ? "Could not update this course" : "Could not create this course"
      );
    } finally {
      setIsSavingForm(false);
    }
  };

  const toggleArchived = async (course: AdminCourse) => {
    const nextStatus = course.status === "archived" ? "active" : "archived";
    setSavingId(course.id);
    try {
      await apiRequest<{ message: string }>(`/admin/courses/${course.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...formFromCourse(course), credits: course.credits, status: nextStatus }),
      });
      await refresh();
      toast.success(nextStatus === "archived" ? `${course.code} archived` : `${course.code} reactivated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this course");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    try {
      await apiRequest<{ message: string }>(`/admin/courses/${courseToDelete.id}`, { method: "DELETE" });
      await refresh();
      toast.success(`${courseToDelete.code} was deleted`);
      setCourseToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this course");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Course oversight"
        description="Every course on the platform, who teaches it, and how many students are enrolled."
        actions={
          <Button size="sm" variant="secondary" className="font-semibold" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New course
          </Button>
        }
      />

      {isFetching && <SyncStatus label="courses" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Courses" value={courses.length} hint="Across all faculties" icon={BookOpenCheck} tone="primary" />
        <StatCard label="Unassigned" value={unassigned} hint="Need a lecturer" icon={UserCheck} tone="warning" />
        <StatCard label="Teaching staff" value={teachers.length} hint="Can be assigned" icon={Users} tone="info" />
      </div>

      <Card className="mb-6 border-border/60 p-4 shadow-soft">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, title, or lecturer..."
            className="pl-9"
          />
        </div>
      </Card>

      {isError ? (
        <LoadError label="courses" error={error} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title={courses.length === 0 ? "No courses yet" : "No courses match your search"}
          detail={courses.length === 0 ? "Create the first course to get started." : "Try a different search term."}
        />
      ) : (
        <Card className="overflow-hidden border-border/60 shadow-soft">
          <ul className="divide-y divide-border">
            {filtered.map((course) => (
              <li key={course.id} className="flex flex-col gap-4 p-5 transition-base hover:bg-secondary/30 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{course.code}</Badge>
                    <Badge variant="secondary" className="capitalize">{course.status}</Badge>
                    {!course.lecturerId && (
                      <Badge className="border border-warning/20 bg-warning/15 text-warning">Unassigned</Badge>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-bold text-foreground">{course.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[course.faculty, course.department, course.semester].filter(Boolean).join(" - ") || "No faculty set"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-lg bg-secondary/50 px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Students</p>
                    <p className="font-semibold text-foreground">{course.students}</p>
                  </div>

                  <div className="min-w-[14rem]">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Lecturer
                    </label>
                    <Select
                      value={course.lecturerId || UNASSIGNED}
                      onValueChange={(value) => assignLecturer(course, value)}
                      disabled={savingId === course.id}
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {savingId === course.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      onClick={() => openEdit(course)}
                      aria-label={`Edit ${course.code}`}
                      title="Edit course"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      onClick={() => toggleArchived(course)}
                      disabled={savingId === course.id}
                      aria-label={course.status === "archived" ? `Reactivate ${course.code}` : `Archive ${course.code}`}
                      title={course.status === "archived" ? "Reactivate course" : "Archive course"}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCourseToDelete(course)}
                      aria-label={`Delete ${course.code}`}
                      title="Delete course"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingCourse ? `Edit ${editingCourse.code}` : "Create a new course"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="course-code">Course code</Label>
              <Input
                id="course-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="CS401"
              />
            </div>
            <div>
              <Label htmlFor="course-credits">Credits</Label>
              <Input
                id="course-credits"
                type="number"
                min={1}
                max={10}
                value={form.credits}
                onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="course-title">Title</Label>
              <Input
                id="course-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Distributed Systems"
              />
            </div>
            <div>
              <Label htmlFor="course-faculty">Faculty</Label>
              <Input
                id="course-faculty"
                value={form.faculty}
                onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="course-department">Department</Label>
              <Input
                id="course-department"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="course-semester">Semester</Label>
              <Input
                id="course-semester"
                value={form.semester}
                onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                placeholder="Year 2 - Semester 2"
              />
            </div>
            <div>
              <Label htmlFor="course-room">Room</Label>
              <Input
                id="course-room"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="course-schedule">Schedule</Label>
              <Input
                id="course-schedule"
                value={form.schedule}
                onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                placeholder="Monday 08:00 - 09:30"
              />
            </div>
            {editingCourse && (
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label htmlFor="course-description">Description</Label>
              <Textarea
                id="course-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="min-h-[5rem]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={isSavingForm}>
              Cancel
            </Button>
            <Button onClick={saveCourse} className="bg-gradient-primary text-primary-foreground" disabled={isSavingForm}>
              {isSavingForm ? "Saving..." : editingCourse ? "Save changes" : "Create course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(courseToDelete)} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              {courseToDelete
                ? `${courseToDelete.code} - ${courseToDelete.title} will be permanently removed, along with its materials, assignments, quizzes, and enrollments. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete course"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
