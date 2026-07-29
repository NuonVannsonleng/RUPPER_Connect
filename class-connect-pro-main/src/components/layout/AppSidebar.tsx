import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  BookOpen,
  BookOpenCheck,
  Brain,
  CalendarDays,
  FileText,
  Megaphone,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import schoolLogo from "@/assets/school-logo.webp";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRole } from "@/context/RoleContext";

const teacherNav = [
  { title: "Dashboard",     url: "/dashboard",     icon: LayoutDashboard },
  { title: "Courses",       url: "/courses",       icon: BookOpenCheck },
  { title: "Assignments",   url: "/assignments",   icon: FileText },
  { title: "Quizzes",       url: "/quizzes",       icon: Brain },
  { title: "Attendance",    url: "/attendance",    icon: ClipboardCheck },
  { title: "Gradebook",     url: "/gradebook",     icon: BookOpen },
  { title: "Schedule",      url: "/schedule",      icon: CalendarDays },
  { title: "Calendar",      url: "/calendar",      icon: CalendarDays },
  { title: "Messages",      url: "/messages",      icon: MessagesSquare },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Settings",      url: "/settings",      icon: Settings },
];

const adminNav = [
  { title: "Overview",     url: "/admin",         icon: ShieldCheck },
  { title: "Users",        url: "/admin/users",   icon: UserCog },
  { title: "Courses",      url: "/admin/courses", icon: BookOpenCheck },
  { title: "Settings",     url: "/settings",      icon: Settings },
];

const studentNav = [
  { title: "Dashboard",     url: "/dashboard",     icon: LayoutDashboard },
  { title: "Courses",       url: "/courses",       icon: BookOpenCheck },
  { title: "Assignments",   url: "/assignments",   icon: FileText },
  { title: "Quizzes",       url: "/quizzes",       icon: Brain },
  { title: "My Attendance", url: "/attendance",    icon: ClipboardCheck },
  { title: "My Grades",     url: "/gradebook",     icon: BookOpen },
  { title: "Schedule",      url: "/schedule",      icon: CalendarDays },
  { title: "Calendar",      url: "/calendar",      icon: CalendarDays },
  { title: "Transcript",    url: "/transcript",    icon: ScrollText },
  { title: "Messages",      url: "/messages",      icon: MessagesSquare },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Settings",      url: "/settings",      icon: Settings },
];

const navForRole = { admin: adminNav, teacher: teacherNav, student: studentNav };

export function AppSidebar() {
  const { role } = useRole();
  const location = useLocation();

  const items = navForRole[role] ?? studentNav;
  const home = role === "admin" ? "/admin" : "/dashboard";

  // Highlight the most specific match, so "/admin" doesn't stay lit while you're on
  // "/admin/users" - a plain startsWith would light up both.
  const activeUrl = items
    .map((item) => item.url)
    .filter((url) => location.pathname === url || location.pathname.startsWith(`${url}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Collapse styling is driven by the sidebar's own data-collapsible attribute rather
          than React state, so the logo and wordmark ease out in lockstep with the 200ms
          width animation instead of popping the moment the state flips. */}
      <SidebarHeader className="overflow-hidden border-b border-sidebar-border px-4 py-5 transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-0">
        <Link
          to={home}
          aria-label="RUPPER Connect - go to dashboard"
          className="flex items-center gap-3 rounded-xl outline-none transition-[gap,opacity] duration-200 ease-linear hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
        >
          {/* Scaled rather than resized: transform keeps this off the layout path, and
              0.8 x 40px lands on 32px so the logo lines up exactly with the nav icons. */}
          <img
            src={schoolLogo}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full bg-white object-contain p-0.5 shadow-soft transition-transform duration-200 ease-linear group-data-[collapsible=icon]:scale-[0.8]"
          />
          <span className="flex min-w-0 max-w-[10rem] flex-col overflow-hidden whitespace-nowrap leading-tight transition-[max-width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="font-display text-base font-bold text-sidebar-foreground">
              RUPPER
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/60">
              Connect
            </span>
          </span>
        </Link>
      </SidebarHeader>

      {/* Collapsed the rail is 3rem wide and the buttons are forced to 2rem, so the default
          px-2 left them wedged against both edges. Dropping the padding when collapsed and
          centring the buttons gives them an even 8px of breathing room. */}
      <SidebarContent className="px-2 py-4 group-data-[collapsible=icon]:px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            {role === "admin" ? "Administration" : role === "teacher" ? "Teaching" : "Learning"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.url === activeUrl;
                return (
                  <SidebarMenuItem key={item.title}> 
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className={`transition-base group-data-[collapsible=icon]:mx-auto ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <RouterNavLink to={item.url} end={item.url === "/dashboard"}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                        )}
                      </RouterNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
