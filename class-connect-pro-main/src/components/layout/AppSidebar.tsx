import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
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
} from "lucide-react";
import schoolLogo from "@/assets/school-logo.png";

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
  useSidebar,
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useRole();
  const location = useLocation();

  const items = role === "teacher" ? teacherNav : studentNav;

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={`border-b border-sidebar-border py-5 ${collapsed ? "px-1" : "px-4"}`}>
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <img
            src={schoolLogo}
            alt="RUPPER logo"
            className={`rounded-full object-contain transition-base ${
              collapsed
                ? "h-10 w-10 bg-transparent p-0 shadow-none ring-1 ring-sidebar-primary/25"
                : "h-10 w-10 bg-white p-0.5 shadow-soft"
            }`}
          />
          {!collapsed && (
            <div className="flex flex-col leading-tight animate-fade-in">
              <span className="font-display text-base font-bold text-sidebar-foreground">
                RUPPER
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Connect
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            {role === "teacher" ? "Teaching" : "Learning"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}> 
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className={`transition-base ${
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
