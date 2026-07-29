import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  BookOpenCheck,
  Brain,
  CalendarClock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MessageSquare,
  Search,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  useAcademicAssignments,
  useAcademicCalendar,
  useAcademicCourses,
  useAcademicQuizzes,
} from "@/hooks/useAcademicPlatform";
import { faculties } from "@/data/faculties";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useSchedule } from "@/hooks/useSchedule";
import { useRole } from "@/context/RoleContext";

type ResultType = "Page" | "Faculty" | "Department" | "Course" | "Schedule" | "Announcement";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  keywords: string;
}

const adminPageResults: SearchResult[] = [
  {
    id: "page-admin-overview",
    type: "Page",
    title: "Admin overview",
    description: "Platform statistics and the newest accounts",
    path: "/admin",
    icon: LayoutDashboard,
    keywords: "admin overview stats platform dashboard",
  },
  {
    id: "page-admin-users",
    type: "Page",
    title: "User management",
    description: "Create accounts, change roles, remove users",
    path: "/admin/users",
    icon: FileText,
    keywords: "users accounts roles admin teacher student promote delete",
  },
  {
    id: "page-admin-courses",
    type: "Page",
    title: "Course oversight",
    description: "Every course and who teaches it",
    path: "/admin/courses",
    icon: BookOpenCheck,
    keywords: "courses lecturer assign oversight",
  },
];

/**
 * Results point at real routes, and the router now rejects a role that shouldn't be there -
 * so filter anything the current role can't actually open, or the result becomes a dead end
 * that bounces them straight back.
 */
const canAccess = (role: string, path: string) => {
  if (path.startsWith("/admin")) return role === "admin";
  if (path.startsWith("/faculty") || path === "/settings") return true;
  return role !== "admin";
};

const pageResults: SearchResult[] = [
  {
    id: "page-dashboard",
    type: "Page",
    title: "Dashboard",
    description: "Overview, today's classes, stats, and latest notices",
    path: "/dashboard",
    icon: LayoutDashboard,
    keywords: "home overview today stats portal",
  },
  {
    id: "page-attendance",
    type: "Page",
    title: "Attendance",
    description: "Student attendance records and class presence",
    path: "/attendance",
    icon: FileText,
    keywords: "present absent late students",
  },
  {
    id: "page-courses",
    type: "Page",
    title: "Courses",
    description: "Course materials, assignments, quizzes, discussions, attendance, and grades",
    path: "/courses",
    icon: BookOpenCheck,
    keywords: "courses materials lecturer assignments quizzes discussions progress",
  },
  {
    id: "page-assignments",
    type: "Page",
    title: "Assignments",
    description: "Deadlines, submissions, scores, and teacher feedback",
    path: "/assignments",
    icon: FileText,
    keywords: "assignment submit upload deadline feedback score",
  },
  {
    id: "page-quizzes",
    type: "Page",
    title: "Quizzes",
    description: "Online quizzes, exams, MCQ, true false, results, and auto grading",
    path: "/quizzes",
    icon: Brain,
    keywords: "quiz exam assessment questions mcq true false time limit",
  },
  {
    id: "page-gradebook",
    type: "Page",
    title: "Gradebook",
    description: "Scores, assignments, class average, and grades",
    path: "/gradebook",
    icon: BookOpen,
    keywords: "grades scores assignments marks",
  },
  {
    id: "page-calendar",
    type: "Page",
    title: "Academic Calendar",
    description: "Exams, assignments, holidays, and university events",
    path: "/calendar",
    icon: CalendarClock,
    keywords: "calendar academic exam assignment holiday event university",
  },
  {
    id: "page-transcript",
    type: "Page",
    title: "Transcript",
    description: "Course history, credits, semester GPA, and overall GPA",
    path: "/transcript",
    icon: GraduationCap,
    keywords: "transcript gpa credits records grades semester pdf",
  },
  {
    id: "page-messages",
    type: "Page",
    title: "Messages",
    description: "Internal teacher and student communication",
    path: "/messages",
    icon: MessageSquare,
    keywords: "messages chat inbox teacher student communication",
  },
  {
    id: "page-schedule",
    type: "Page",
    title: "Schedule",
    description: "Weekly classes, rooms, teachers, and times",
    path: "/schedule",
    icon: CalendarClock,
    keywords: "calendar timetable class room teacher",
  },
  {
    id: "page-announcements",
    type: "Page",
    title: "Announcements",
    description: "University notices, urgent updates, exams, and events",
    path: "/announcements",
    icon: Megaphone,
    keywords: "notices news urgent exams events",
  },
  {
    id: "page-settings",
    type: "Page",
    title: "Settings",
    description: "Profile, theme, password, and account preferences",
    path: "/settings",
    icon: Settings,
    keywords: "profile account dark light theme password",
  },
];

const typeTone: Record<ResultType, string> = {
  Page: "bg-primary/10 text-primary",
  Faculty: "bg-primary/10 text-primary",
  Department: "bg-accent/20 text-accent-foreground",
  Course: "bg-accent/20 text-accent-foreground",
  Schedule: "bg-success/10 text-success",
  Announcement: "bg-warning/15 text-warning",
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const { role } = useRole();
  const { data: scheduleItems = [] } = useSchedule();
  const { data: announcementItems = [] } = useAnnouncements();
  const { data: academicCourseItems = [] } = useAcademicCourses();
  const { data: academicAssignmentItems = [] } = useAcademicAssignments();
  const { data: academicQuizItems = [] } = useAcademicQuizzes();
  const { data: academicCalendarItems = [] } = useAcademicCalendar();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = window.setTimeout(() => setIsSearching(false), 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const allResults = useMemo<SearchResult[]>(() => {
    const facultyResults = faculties.flatMap((faculty) => {
      const facultyResult: SearchResult = {
        id: `faculty-${faculty.id}`,
        type: "Faculty",
        title: faculty.name,
        description: `${faculty.departments.length} departments - ${faculty.description}`,
        path: `/faculty/${faculty.id}`,
        icon: GraduationCap,
        keywords: `${faculty.shortName || ""} RUPP university faculty courses programs departments`,
      };

      const departmentResults: SearchResult[] = faculty.departments.map((department) => ({
        id: `department-${faculty.id}-${department}`,
        type: "Department",
        title: department,
        description: `${faculty.name} department`,
        path: `/faculty/${faculty.id}`,
        icon: BookOpen,
        keywords: `${faculty.name} ${faculty.shortName || ""} RUPP course faculty program`,
      }));

      return [facultyResult, ...departmentResults];
    });

    const scheduleResults = scheduleItems.map((item) => ({
      id: `schedule-${item.id}`,
      type: "Schedule" as const,
      title: item.subject,
      description: `${item.day}, ${item.time} - ${item.room} - ${item.teacher}`,
      path: "/schedule",
      icon: CalendarClock,
      keywords: `${item.day} ${item.time} ${item.room} ${item.teacher} class timetable`,
    }));

    const announcementResults = announcementItems.map((item) => ({
      id: `announcement-${item.id}`,
      type: "Announcement" as const,
      title: item.title,
      description: `${item.category} - ${item.body}`,
      path: "/announcements",
      icon: Megaphone,
      keywords: `${item.author} ${item.date} ${item.category} notice news`,
    }));

    const courseResults: SearchResult[] = academicCourseItems.map((course) => ({
      id: `course-${course.id}`,
      type: "Course",
      title: `${course.code} ${course.title}`,
      description: `${course.lecturer} - ${course.schedule} - ${course.room}`,
      path: "/courses",
      icon: GraduationCap,
      keywords: `${course.faculty} ${course.department} materials quizzes assignments discussion attendance grades`,
    }));

    const assignmentResults = academicAssignmentItems.map((item) => ({
      id: `academic-assignment-${item.id}`,
      type: "Course" as const,
      title: item.title,
      description: `${item.courseCode} assignment due ${item.deadline}`,
      path: "/assignments",
      icon: FileText,
      keywords: `${item.status} deadline submit score feedback`,
    }));

    const quizResults = academicQuizItems.map((item) => ({
      id: `academic-quiz-${item.id}`,
      type: "Course" as const,
      title: item.title,
      description: `${item.courseCode} quiz - ${item.questions} questions - ${item.timeLimit} minutes`,
      path: "/quizzes",
      icon: Brain,
      keywords: `${item.status} mcq true false assessment exam result`,
    }));

    const calendarResults = academicCalendarItems.map((item) => ({
      id: `academic-calendar-${item.id}`,
      type: "Schedule" as const,
      title: item.title,
      description: `${item.type} - ${item.date}${item.course ? ` - ${item.course}` : ""}`,
      path: "/calendar",
      icon: CalendarClock,
      keywords: `${item.priority} exam assignment holiday event academic date`,
    }));

    return [
      ...(role === "admin" ? adminPageResults : pageResults),
      ...facultyResults,
      ...courseResults,
      ...assignmentResults,
      ...quizResults,
      ...calendarResults,
      ...scheduleResults,
      ...announcementResults,
    ].filter((item) => canAccess(role, item.path));
  }, [academicAssignmentItems, academicCalendarItems, academicCourseItems, academicQuizItems, announcementItems, role, scheduleItems]);

  const normalizedQuery = query.trim().toLowerCase();
  const suggestedPages = role === "admin" ? adminPageResults : pageResults;
  const results = useMemo(() => {
    if (!normalizedQuery) return [...suggestedPages.slice(0, 4), ...faculties.slice(0, 4).map((faculty) => ({
      id: `faculty-suggestion-${faculty.id}`,
      type: "Faculty" as const,
      title: faculty.name,
      description: `${faculty.departments.length} departments - ${faculty.description}`,
      path: `/faculty/${faculty.id}`,
      icon: GraduationCap,
      keywords: faculty.name,
    }))];

    return allResults
      .filter((item) =>
        `${item.title} ${item.description} ${item.type} ${item.keywords}`
          .toLowerCase()
          .includes(normalizedQuery)
      )
      .slice(0, 8);
  }, [allResults, normalizedQuery, suggestedPages]);

  const openResult = (result: SearchResult) => {
    setQuery("");
    setIsFocused(false);
    navigate(result.path);
  };

  const handleEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && results[0] && !isSearching) {
      event.preventDefault();
      openResult(results[0]);
    }
  };

  return (
    <div className="relative hidden flex-1 max-w-md md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => window.setTimeout(() => setIsFocused(false), 140)}
        onKeyDown={handleEnter}
        placeholder="Search faculties, courses, schedule, announcements..."
        className="h-10 rounded-full border-transparent bg-secondary/70 pl-9 pr-4 shadow-sm transition-base focus-visible:bg-background"
      />

      {isFocused && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-border bg-popover shadow-elegant animate-fade-in">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {normalizedQuery ? "Search results" : "Suggestions"}
            </p>
          </div>

          {isSearching ? (
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Searching university portal...
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto p-2">
              {results.map((result) => {
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openResult(result)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-base hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${typeTone[result.type]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{result.title}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {result.type}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {result.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-7 text-center">
              <p className="text-sm font-semibold text-foreground">No results found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a course name, schedule day, announcement keyword, or page.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
