import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Loader2, Search, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SyncStatus } from "@/components/shared/SyncStatus";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ADMIN_COURSES_QUERY_KEY,
  useAdminCourses,
  useAdminUsers,
  type AdminCourse,
} from "@/hooks/useAdmin";
import { apiRequest } from "@/lib/api";

const UNASSIGNED = "unassigned";

export default function CourseOversight() {
  const queryClient = useQueryClient();
  const { data: courses = [], isFetching, isError, error, refetch } = useAdminCourses();
  const { data: users = [] } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const assignLecturer = async (course: AdminCourse, lecturerId: string) => {
    setSavingId(course.id);
    try {
      await apiRequest<{ message: string }>(`/admin/courses/${course.id}/lecturer`, {
        method: "PUT",
        body: JSON.stringify({ lecturerId: lecturerId === UNASSIGNED ? null : lecturerId }),
      });
      await queryClient.invalidateQueries({ queryKey: ADMIN_COURSES_QUERY_KEY });
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

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Course oversight"
        description="Every course on the platform, who teaches it, and how many students are enrolled."
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
          detail={courses.length === 0 ? "Courses created by teachers will appear here." : "Try a different search term."}
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
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
