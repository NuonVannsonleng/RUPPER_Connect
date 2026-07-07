import {
  Users,
  ClipboardCheck,
  CalendarClock,
  Megaphone,
  TrendingUp,
  Award,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/shared/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/context/RoleContext";
import { students } from "@/data/mockData";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { calculateClassAverage, calculateStudentAverages, useGradebook } from "@/hooks/useGradebook";
import { useSchedule } from "@/hooks/useSchedule";

export default function Dashboard() {
  const { role, user } = useRole();
  const { data: announcementItems = [] } = useAnnouncements();
  const { data: scheduleItems = [] } = useSchedule();
  const { data: gradeMap = {} } = useGradebook();
  const latestAnnouncements = announcementItems.slice(0, 3);

  // ---- Derive lightweight stats from shared app data ----
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const visibleSchedule = scheduleItems.filter(
    (session) => session.roleVisibility === "both" || session.roleVisibility === role
  );
  const todaysClasses = visibleSchedule
    .filter((session) => session.day === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const classAverage = calculateClassAverage(gradeMap);
  const studentAverages = calculateStudentAverages(gradeMap);
  const currentStudentAverage = studentAverages[students[0]?.id] ?? 0;

  const teacherStats = [
    { label: "Students",        value: students.length,              hint: "Section 11-A",         icon: Users,          tone: "primary" as const, to: "/attendance" },
    { label: "Classes Today",   value: todaysClasses.length,         hint: today,                  icon: CalendarClock,  tone: "info" as const,    to: "/schedule" },
    { label: "Class Average",   value: `${classAverage}%`,           hint: "Across all assignments", icon: TrendingUp,   tone: "success" as const, to: "/gradebook" },
    { label: "Announcements",   value: announcementItems.length,     hint: "Published notices",    icon: Megaphone,      tone: "warning" as const, to: "/announcements" },
  ];

  const studentStats = [
    { label: "Attendance",    value: "94%",                       hint: "This semester",    icon: ClipboardCheck, tone: "success" as const, to: "/attendance" },
    { label: "Average Grade", value: `${currentStudentAverage}%`, hint: "From your gradebook", icon: Award,          tone: "primary" as const, to: "/gradebook" },
    { label: "Classes Today", value: todaysClasses.length,        hint: today,              icon: CalendarClock,   tone: "info" as const,    to: "/schedule" },
    { label: "New Notices",   value: announcementItems.length,    hint: "Latest announcements", icon: Megaphone,  tone: "warning" as const, to: "/announcements" },
  ];

  const stats = role === "teacher" ? teacherStats : studentStats;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero greeting */}
      <Card className="relative overflow-hidden border-0 campus-hero-bg p-6 text-primary-foreground shadow-elegant sm:p-10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 right-1/3 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
            {role === "teacher" ? "Teacher dashboard" : "Student dashboard"}
          </p>
          <h2 className="font-display text-2xl font-bold sm:text-4xl">
            Welcome back, {user.name.split(" ").slice(-1)[0]}
          </h2>
          <p className="mt-2 text-sm text-primary-foreground/80 sm:text-base">
            {role === "teacher"
              ? "Here's a snapshot of your classes, students and what's due today."
              : "Here's your learning at a glance - schedule, grades and announcements."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary" className="font-semibold">
              <Link to={role === "teacher" ? "/attendance" : "/schedule"}>
                {role === "teacher" ? "Take attendance" : "View today's schedule"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            >
              <Link to="/announcements">See announcements</Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two-column: today + announcements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Today's classes</h3>
              <p className="text-xs text-muted-foreground">{today}</p>
            </div>
            <Badge variant="secondary" className="rounded-full">
              {todaysClasses.length} sessions
            </Badge>
          </div>
          <div className="space-y-2">
            {todaysClasses.length > 0 ? (
              todaysClasses.map((cls) => (
                <div
                  key={cls.id}
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
                  <Badge className="hidden bg-success/15 text-success hover:bg-success/15 sm:inline-flex">
                    On track
                  </Badge>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm font-medium text-foreground">No classes today.</p>
                <p className="mt-1 text-xs text-muted-foreground">Your schedule page has the full weekly timetable.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Latest announcements</h3>
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <Link to="/announcements">
                View all
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="space-y-2">
            {latestAnnouncements.length > 0 ? (
              latestAnnouncements.map((n) => (
                <Link
                  key={n.id}
                  to="/announcements"
                  className="block rounded-md border-l-2 border-accent/70 py-1 pl-3 transition-base hover:border-primary hover:bg-secondary/50"
                >
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {n.author} - {n.date}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-border p-4 text-center">
                <p className="text-sm font-medium text-foreground">No announcements yet.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
