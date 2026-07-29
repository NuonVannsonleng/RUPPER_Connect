import {
  AlertTriangle,
  Award,
  Bell,
  BookOpenCheck,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";
import {
  attendanceTrend,
  gpaProgress,
  gradePerformance,
  platformNotifications,
  teacherClassAnalytics,
} from "@/data/academicPlatform";
import {
  useAcademicAssignments,
  useAcademicCourses,
  useAcademicRiskAlerts,
  useAcademicTranscript,
} from "@/hooks/useAcademicPlatform";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useAttendanceSummary, useClassAttendanceSummary } from "@/hooks/useAttendanceSummary";
import { calculateClassAverage, calculateStudentAverages, useGradebook, useGradebookRoster } from "@/hooks/useGradebook";
import { useSchedule } from "@/hooks/useSchedule";

const chartPrimary = "hsl(var(--primary))";
const chartAccent = "hsl(var(--accent))";
const chartSuccess = "hsl(var(--success))";
const chartMuted = "hsl(var(--muted-foreground))";

export default function Dashboard() {
  const { role } = useRole();
  const { user } = useAuth();
  const { data: announcementItems = [] } = useAnnouncements();
  const { data: scheduleItems = [] } = useSchedule();
  const { data: gradeMap = {} } = useGradebook();
  const { data: gradebookRoster = [] } = useGradebookRoster();
  const { data: academicCourses = [] } = useAcademicCourses();
  const { data: academicAssignments = [] } = useAcademicAssignments();
  const { data: studentRiskAlerts = [] } = useAcademicRiskAlerts();
  const { data: transcriptRecords = [] } = useAcademicTranscript();
  const { data: attendanceSummary } = useAttendanceSummary();
  const { data: classAttendanceSummary } = useClassAttendanceSummary(role === "teacher");

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const visibleSchedule = scheduleItems.filter(
    (session) => session.roleVisibility === "both" || session.roleVisibility === role
  );
  const todaysClasses = visibleSchedule
    .filter((session) => session.day === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const latestAnnouncements = announcementItems.slice(0, 3);

  const classAverage = calculateClassAverage(gradeMap, gradebookRoster);
  const studentAverages = calculateStudentAverages(gradeMap, gradebookRoster);
  const currentStudentAverage = studentAverages[String(user?.id ?? "")] ?? 0;

  const completedCredits = transcriptRecords.reduce((total, record) => total + record.credits, 0);
  const weightedGpa = completedCredits
    ? transcriptRecords.reduce((total, record) => total + record.gradePoint * record.credits, 0) / completedCredits
    : 0;
  const latestSemester = transcriptRecords[transcriptRecords.length - 1]?.semester ?? "Current term";

  const totalSubmissions = academicAssignments.reduce((sum, item) => sum + item.submissionCount, 0);
  const possibleSubmissions = academicAssignments.length * gradebookRoster.length;
  const completionRate = possibleSubmissions ? Math.round((totalSubmissions / possibleSubmissions) * 100) : 0;

  const courseGradePerformance = academicCourses.length
    ? academicCourses.map((course) => ({
        course: course.code,
        grade: course.grade || 0,
        average: Math.max(60, (course.grade || 0) - 7),
      }))
    : gradePerformance;

  if (role === "teacher") {
    return (
      <div className="space-y-6 sm:space-y-8">
        <Hero
          eyebrow="Teacher analytics"
          title={`Welcome back, ${user.name.split(" ").slice(-1)[0]}`}
          description="Monitor class performance, attendance, student progress, risk alerts, and daily teaching actions."
          primaryTo="/attendance"
          primaryLabel="Take attendance"
          secondaryTo="/courses"
          secondaryLabel="Manage courses"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total students" value={gradebookRoster.length} hint="Across active classes" icon={Users} tone="primary" to="/attendance" />
          <StatCard label="Active classes" value={academicCourses.length} hint="Current semester" icon={BookOpenCheck} tone="info" to="/courses" />
          <StatCard label="Average grade" value={`${classAverage}%`} hint="Gradebook average" icon={Award} tone="success" to="/gradebook" />
          <StatCard label="Attendance rate" value={`${classAttendanceSummary?.percentage ?? 0}%`} hint="Class trend" icon={ClipboardCheck} tone="success" to="/attendance" />
          <StatCard label="Completion" value={`${completionRate}%`} hint="Assignments submitted" icon={FileText} tone="warning" to="/assignments" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <ChartCard title="Class analytics" description="Performance, attendance, and assignment completion by course.">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teacherClassAnalytics}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: chartMuted, fontSize: 12 }} />
                <YAxis tick={{ fill: chartMuted, fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="performance" fill={chartPrimary} radius={[8, 8, 0, 0]} />
                <Bar dataKey="attendance" fill={chartAccent} radius={[8, 8, 0, 0]} />
                <Bar dataKey="completion" fill={chartSuccess} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <Card className="border-border/60 p-5 shadow-soft sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Student risk alerts</h2>
                <p className="text-sm text-muted-foreground">Automatic monitoring for attendance, grades, and missing work.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="space-y-3">
              {studentRiskAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-border/70 bg-secondary/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{alert.studentName}</p>
                    <Badge variant={alert.severity === "urgent" ? "destructive" : "secondary"}>{alert.severity}</Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground">{alert.issue}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.recommendation}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <DashboardLists
          todaysClasses={todaysClasses}
          today={today}
          latestAnnouncements={latestAnnouncements}
          mode="teacher"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <Hero
        eyebrow="Student dashboard"
        title={`Welcome back, ${user.name.split(" ").slice(-1)[0]}`}
        description="Your academic profile, classes, assignments, grades, announcements, and progress analytics are connected here."
        primaryTo="/schedule"
        primaryLabel="View schedule"
        secondaryTo="/announcements"
        secondaryLabel="See announcements"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <Card className="border-border/60 p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-soft">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student profile</p>
              <h2 className="font-display text-xl font-bold text-foreground">{user?.name}</h2>
              <p className="text-sm text-muted-foreground">{user?.studentId || user?.email}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileLine label="Email" value={user?.email ?? "-"} />
            <ProfileLine label="Major" value={user?.major || "Not set"} />
            <ProfileLine label="Semester" value={latestSemester} />
            <ProfileLine label="Completed credits" value={completedCredits} />
            <ProfileLine label="GPA" value={weightedGpa.toFixed(2)} />
            <ProfileLine label="Enrolled classes" value={academicCourses.length} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Today's classes" value={todaysClasses.length} hint={today} icon={CalendarClock} tone="info" to="/schedule" />
          <StatCard label="Assignments" value={academicAssignments.filter((item) => item.status === "pending").length} hint="Pending work" icon={FileText} tone="warning" to="/assignments" />
          <StatCard label="Recent grade" value={`${currentStudentAverage}%`} hint="From gradebook" icon={Award} tone="success" to="/gradebook" />
          <StatCard label="Announcements" value={announcementItems.length} hint="Latest notices" icon={Megaphone} tone="warning" to="/announcements" />
          <StatCard label="Notifications" value={platformNotifications.length} hint="Needs review" icon={Bell} tone="primary" to="/messages" />
          <StatCard label="Attendance" value={`${attendanceSummary?.percentage ?? 0}%`} hint="This semester" icon={ClipboardCheck} tone="success" to="/attendance" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="GPA progress" description="Semester GPA movement.">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={gpaProgress}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="semester" tick={{ fill: chartMuted, fontSize: 12 }} />
              <YAxis domain={[2.5, 4]} tick={{ fill: chartMuted, fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Line type="monotone" dataKey="gpa" stroke={chartPrimary} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Grade by course" description="Your score compared with class average.">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={courseGradePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="course" tick={{ fill: chartMuted, fontSize: 12 }} />
              <YAxis tick={{ fill: chartMuted, fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Bar dataKey="grade" fill={chartPrimary} radius={[8, 8, 0, 0]} />
              <Bar dataKey="average" fill={chartAccent} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Attendance trend" description="Weekly attendance percentage.">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fill: chartMuted, fontSize: 12 }} />
              <YAxis domain={[70, 100]} tick={{ fill: chartMuted, fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Line type="monotone" dataKey="attendance" stroke={chartSuccess} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <DashboardLists todaysClasses={todaysClasses} today={today} latestAnnouncements={latestAnnouncements} mode="student" />
    </div>
  );
}

function Hero({
  eyebrow,
  title,
  description,
  primaryTo,
  primaryLabel,
  secondaryTo,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryTo: string;
  primaryLabel: string;
  secondaryTo: string;
  secondaryLabel: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 campus-hero-bg p-6 text-primary-foreground shadow-elegant sm:p-10">
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-24 right-1/3 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
      <div className="relative max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">{eyebrow}</p>
        <h1 className="font-display text-2xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-primary-foreground/80 sm:text-base">{description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary" className="font-semibold">
            <Link to={primaryTo}>
              {primaryLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <Link to={secondaryTo}>{secondaryLabel}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DashboardLists({
  todaysClasses,
  today,
  latestAnnouncements,
  mode,
}: {
  todaysClasses: Array<{
    id: string;
    subject: string;
    room: string;
    teacher: string;
    startTime: string;
  }>;
  today: string;
  latestAnnouncements: Array<{
    id: string | number;
    title: string;
    body: string;
    author: string;
    date: string;
  }>;
  mode: "teacher" | "student";
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="p-5 shadow-soft sm:p-6 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Today's classes</h2>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
          <Badge variant="secondary">{todaysClasses.length} sessions</Badge>
        </div>
        <div className="space-y-2">
          {todaysClasses.length > 0 ? (
            todaysClasses.map((cls) => (
              <Link
                key={cls.id}
                to="/schedule"
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-3 transition-base hover:border-primary/30 hover:bg-secondary/40"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-sm font-bold text-primary">
                  {cls.startTime}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{cls.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {cls.room} - {cls.teacher}
                  </p>
                </div>
                <Badge className="hidden bg-success/15 text-success hover:bg-success/15 sm:inline-flex">On track</Badge>
              </Link>
            ))
          ) : (
            <EmptyLine title="No classes today." detail="Your schedule page has the full weekly timetable." />
          )}
        </div>
      </Card>

      <Card className="p-5 shadow-soft sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Latest announcements</h2>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Link to="/announcements">
              View all
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="space-y-2">
          {latestAnnouncements.length > 0 ? (
            latestAnnouncements.map((item) => (
              <Link
                key={item.id}
                to="/announcements"
                className="block rounded-md border-l-2 border-accent/70 py-1 pl-3 transition-base hover:border-primary hover:bg-secondary/50"
              >
                <p className="line-clamp-1 text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.author} - {item.date}
                </p>
              </Link>
            ))
          ) : (
            <EmptyLine title="No announcements yet." detail="Published notices will appear here automatically." />
          )}
        </div>

        {mode === "student" && (
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Notifications</h3>
            <div className="space-y-2">
              {platformNotifications.map((notification) => (
                <div key={notification} className="rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                  {notification}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60 p-5 shadow-soft sm:p-6">
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function ProfileLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyLine({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
