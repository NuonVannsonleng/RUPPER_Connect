import {
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Plus,
  Upload,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/context/RoleContext";
import { ACADEMIC_COURSES_QUERY_KEY, useAcademicCourses } from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";

const statusTone = {
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  "at-risk": "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Courses() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: courses = [], isFetching } = useAcademicCourses();
  const isTeacher = role === "teacher";

  const createCourse = async () => {
    try {
      await apiRequest<{ message: string }>("/academic/courses", {
        method: "POST",
        body: JSON.stringify({
          code: `RUP${Math.floor(100 + Math.random() * 900)}`,
          title: "New Academic Technology Course",
          faculty: "Faculty of Engineering",
          department: "Information Technology Engineering",
          credits: 3,
          semester: "Year 2 - Semester 2",
          room: "Room TBA",
          schedule: "Friday 09:00 - 10:30",
          description: "New course prepared from the RUPPER Connect teacher workspace.",
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_COURSES_QUERY_KEY });
      toast.success("Course created in backend");
    } catch {
      toast.error("Could not create course");
    }
  };

  const uploadMaterial = async (courseId: string) => {
    try {
      await apiRequest<{ message: string }>(`/academic/courses/${courseId}/materials`, {
        method: "POST",
        body: JSON.stringify({ title: "New lecture resource", type: "PDF" }),
      });
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_COURSES_QUERY_KEY });
      toast.success("Material uploaded to backend");
    } catch {
      toast.error("Could not upload material");
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
            <Button size="sm" variant="secondary" className="font-semibold" onClick={createCourse}>
              <Plus className="mr-2 h-4 w-4" />
              New course
            </Button>
          ) : undefined
        }
      />

      {isFetching && (
        <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Syncing course data with backend...
        </div>
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
                    {course.materials.map((material) => (
                      <ActionRow key={material.id} icon={FileText} title={material.title} meta={`${material.type} - ${material.uploadedAt}`} />
                    ))}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => (isTeacher ? uploadMaterial(course.id) : toast.success("Material opened."))}
                    >
                      {isTeacher ? <Upload className="mr-2 h-4 w-4" /> : <BookOpenCheck className="mr-2 h-4 w-4" />}
                      {isTeacher ? "Upload material" : "Open materials"}
                    </Button>
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
                    <Button variant="outline" className="w-full" onClick={() => toast.info(isTeacher ? "Assignment builder prepared." : "Submission workspace prepared.")}>
                      {isTeacher ? "Create assignment" : "Submit assignment"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="quiz" className="mt-4 space-y-3">
                    {course.quizzes.map((quiz) => (
                      <ActionRow key={quiz.id} icon={BookOpenCheck} title={quiz.title} meta={`${quiz.questions} questions - ${quiz.timeLimit} minutes`} />
                    ))}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button variant="outline" onClick={() => toast.info(isTeacher ? "Quiz editor prepared." : "Quiz player prepared.")}>
                        {isTeacher ? "Manage quizzes" : "Take quiz"}
                      </Button>
                      <Button variant="ghost" onClick={() => toast.info("Discussion channel prepared.")}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Discussion
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                {isTeacher && (
                  <Button className="mt-4 w-full bg-gradient-primary text-primary-foreground" onClick={() => toast.info("Student progress view prepared.")}>
                    <Users className="mr-2 h-4 w-4" />
                    View student progress
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
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
