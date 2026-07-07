import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  LogOut,
  Megaphone,
  Search,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRole } from "@/context/RoleContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { Announcement } from "@/data/mockData";
import { useAnnouncements } from "@/hooks/useAnnouncements";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  path: string;
  icon: LucideIcon;
  accent: string;
};

const getAnnouncementAccent = (category?: string) => {
  if (category === "urgent") return "bg-destructive/10 text-destructive";
  if (category === "event") return "bg-success/10 text-success";
  if (category === "exam") return "bg-info/10 text-info";
  return "bg-primary/10 text-primary";
};

const buildNotifications = (role: string, announcementItems: Announcement[]): NotificationItem[] => {
  const recentAnnouncements = announcementItems.slice(0, 2).map((announcement) => ({
    id: `announcement-${announcement.id}`,
    title: announcement.title,
    body: announcement.body,
    time: announcement.date,
    path: "/announcements",
    icon: Megaphone,
    accent: getAnnouncementAccent(announcement.category),
  }));

  if (role === "teacher") {
    return [
      {
        id: "attendance-today",
        title: "Attendance needs review",
        body: "Your current class roster is ready for attendance updates.",
        time: "Today",
        path: "/attendance",
        icon: ClipboardCheck,
        accent: "bg-emerald-500/10 text-emerald-600",
      },
      {
        id: "schedule-manage",
        title: "Schedule management",
        body: "New edit and delete controls are available for class sessions.",
        time: "Today",
        path: "/schedule",
        icon: CalendarClock,
        accent: "bg-amber-500/10 text-amber-600",
      },
      ...recentAnnouncements,
    ];
  }

  return [
    {
      id: "class-reminder",
      title: "Upcoming class",
      body: "Check today's schedule before your next session starts.",
      time: "Today",
      path: "/schedule",
      icon: CalendarClock,
      accent: "bg-amber-500/10 text-amber-600",
    },
    {
      id: "attendance-status",
      title: "Attendance updated",
      body: "Your latest attendance record is available in the attendance page.",
      time: "Today",
      path: "/attendance",
      icon: ClipboardCheck,
      accent: "bg-emerald-500/10 text-emerald-600",
    },
    ...recentAnnouncements,
  ];
};

export function AppHeader() {
  const { role, user } = useRole();
  const { logout, user: authUser } = useAuth();
  const navigate = useNavigate();
  const { data: announcementItems = [] } = useAnnouncements();
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const notifications = useMemo(
    () => buildNotifications(role, announcementItems),
    [announcementItems, role]
  );
  const visibleNotifications = notifications.filter(
    (notification) => !dismissedIds.includes(notification.id)
  );
  const unreadCount = visibleNotifications.filter(
    (notification) => !readIds.includes(notification.id)
  ).length;

  const markAsRead = (id: string) => {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const openNotification = (notification: NotificationItem) => {
    markAsRead(notification.id);
    navigate(notification.path);
  };

  const markAllAsRead = () => {
    setReadIds((current) =>
      Array.from(new Set([...current, ...notifications.map((item) => item.id)]))
    );
  };

  const clearNotifications = () => {
    setDismissedIds((current) =>
      Array.from(new Set([...current, ...visibleNotifications.map((item) => item.id)]))
    );
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
      <SidebarTrigger className="text-foreground" />
      <div className="hidden items-center gap-1 sm:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => navigate(1)}
              aria-label="Forward"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Forward</TooltipContent>
        </Tooltip>
      </div>

      {/* Search hidden on mobile to save space */}
      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students, classes, announcements..."
          className="h-10 pl-9 bg-secondary/60 border-transparent focus-visible:bg-background"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-full"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground ring-2 ring-background">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Notification center</p>
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {visibleNotifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={markAllAsRead}
                    aria-label="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
                {visibleNotifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={clearNotifications}
                    aria-label="Clear notifications"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {visibleNotifications.length > 0 ? (
              <ScrollArea className="max-h-[21rem]">
                <div className="divide-y divide-border">
                  {visibleNotifications.map((notification) => {
                    const Icon = notification.icon;
                    const unread = !readIds.includes(notification.id);

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        className="flex w-full gap-3 px-4 py-3 text-left transition-base hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openNotification(notification)}
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notification.accent}`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span className="line-clamp-1 text-sm font-semibold text-foreground">
                              {notification.title}
                            </span>
                            {unread && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {notification.body}
                          </span>
                          <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
                            {notification.time}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No notifications</p>
                <p className="mt-1 text-xs text-muted-foreground">You are all caught up.</p>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => { logout(); navigate("/login"); }}
          aria-label="Log out"
        >
          <LogOut className="h-5 w-5" />
        </Button>


        <div className="flex items-center gap-3 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-sm">
          <Avatar className="h-8 w-8">
            <AvatarImage src={authUser?.avatar} alt={user.name} />
            <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-xs font-semibold text-foreground">{user.name}</p>
            <p className="text-[10px] text-muted-foreground">{user.subtitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
