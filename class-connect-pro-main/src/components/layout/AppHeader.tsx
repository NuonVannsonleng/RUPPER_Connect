import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  LogOut,
  Megaphone,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRole } from "@/context/RoleContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { Announcement } from "@/data/mockData";
import { ANNOUNCEMENTS_QUERY_KEY, useAnnouncements } from "@/hooks/useAnnouncements";
import { NOTIFICATION_READS_QUERY_KEY, useNotificationReads } from "@/hooks/useNotificationReads";
import { apiRequest } from "@/lib/api";
import { GlobalSearch } from "./GlobalSearch";
import { ProfileMenu } from "./ProfileMenu";

const ANNOUNCEMENT_ID_PREFIX = "announcement-";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  path: string;
  icon: LucideIcon;
  accent: string;
  /** Only set for announcement-backed items - their read state comes from the announcements
   *  API itself (announcement_reads) rather than the generic notification_reads table, so the
   *  bell dropdown and the Announcements page never disagree about the same announcement. */
  isRead?: boolean;
};

const getAnnouncementAccent = (category?: string) => {
  if (category === "urgent") return "bg-destructive/10 text-destructive";
  if (category === "event") return "bg-success/10 text-success";
  if (category === "exam") return "bg-info/10 text-info";
  return "bg-primary/10 text-primary";
};

const buildNotifications = (role: string, announcementItems: Announcement[]): NotificationItem[] => {
  const recentAnnouncements = announcementItems.slice(0, 2).map((announcement) => ({
    id: `${ANNOUNCEMENT_ID_PREFIX}${announcement.id}`,
    title: announcement.title,
    body: announcement.body,
    time: announcement.date,
    path: "/announcements",
    icon: Megaphone,
    accent: getAnnouncementAccent(announcement.category),
    isRead: announcement.isRead,
  }));

  // Admins don't have the teaching/learning pages, so point them at their own area
  // rather than at routes their role can't open.
  if (role === "admin") {
    return [
      {
        id: "admin-users",
        title: "Manage accounts",
        body: "Review roles, add staff, and keep the platform's access list tidy.",
        time: "Today",
        path: "/admin/users",
        icon: ClipboardCheck,
        accent: "bg-emerald-500/10 text-emerald-600",
      },
      {
        id: "admin-courses",
        title: "Course oversight",
        body: "Check which courses still need a lecturer assigned.",
        time: "Today",
        path: "/admin/courses",
        icon: CalendarClock,
        accent: "bg-amber-500/10 text-amber-600",
      },
    ];
  }

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
  const { role } = useRole();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: announcementItems = [] } = useAnnouncements();
  // Persisted read state for the synthetic, per-role items ("attendance-today" and friends)
  // that have no database row of their own - announcement-backed items instead carry their
  // own isRead straight from the announcements API. readIds is a local optimistic overlay on
  // top of that persisted data: seeded from it on load/refetch below, added to immediately on
  // click for a responsive UI, and rolled back if the write fails.
  const { data: persistedReadKeys = [] } = useNotificationReads();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds((current) => {
      const next = new Set(current);
      persistedReadKeys.forEach((key) => next.add(key));
      return next;
    });
  }, [persistedReadKeys]);

  const notifications = useMemo(
    () => buildNotifications(role, announcementItems),
    [announcementItems, role]
  );
  const visibleNotifications = notifications.filter(
    (notification) => !dismissedIds.includes(notification.id)
  );
  const isNotificationRead = (notification: NotificationItem) =>
    notification.isRead === true || readIds.has(notification.id);
  const unreadCount = visibleNotifications.filter(
    (notification) => !isNotificationRead(notification)
  ).length;

  // Announcement-backed items persist through the same endpoint the Announcements page uses
  // (announcement_reads) so the two views never disagree about the same announcement; every
  // other item persists through the generic notification_reads table.
  const persistRead = (id: string) =>
    id.startsWith(ANNOUNCEMENT_ID_PREFIX)
      ? apiRequest<{ message: string }>(`/announcements/${id.slice(ANNOUNCEMENT_ID_PREFIX.length)}/read`, {
          method: "PUT",
        })
      : apiRequest<{ message: string }>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" });

  const markAsRead = async (notification: NotificationItem) => {
    if (isNotificationRead(notification)) return;

    setReadIds((current) => new Set(current).add(notification.id));
    try {
      await persistRead(notification.id);
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_READS_QUERY_KEY });
    } catch {
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
      toast.error("Could not save read status");
    }
  };

  const openNotification = (notification: NotificationItem) => {
    markAsRead(notification);
    navigate(notification.path);
  };

  const markAllAsRead = async () => {
    const unread = visibleNotifications.filter((item) => !isNotificationRead(item));
    if (!unread.length) return;

    setReadIds((current) => {
      const next = new Set(current);
      unread.forEach((item) => next.add(item.id));
      return next;
    });

    const results = await Promise.allSettled(unread.map((item) => persistRead(item.id)));
    const failedIds = unread
      .filter((_, index) => results[index].status === "rejected")
      .map((item) => item.id);

    if (failedIds.length) {
      setReadIds((current) => {
        const next = new Set(current);
        failedIds.forEach((id) => next.delete(id));
        return next;
      });
      toast.error(
        failedIds.length === unread.length
          ? "Could not mark notifications as read"
          : "Some notifications could not be marked as read"
      );
    }

    queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: NOTIFICATION_READS_QUERY_KEY });
  };

  const clearNotifications = () => {
    setDismissedIds((current) =>
      Array.from(new Set([...current, ...visibleNotifications.map((item) => item.id)]))
    );
  };

  // The bar is opaque unless the browser really supports backdrop-filter. With a bare
  // bg-background/80 it was 20% see-through wherever the blur silently failed - most in-app
  // browsers and older iOS Safari - so the page hero showed straight through the header as it
  // scrolled underneath.
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background px-3 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-md sm:gap-4 sm:px-6">
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

      <GlobalSearch />

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
                    const unread = !isNotificationRead(notification);

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

        {/* Hidden on phones, where the bar has no room to spare - the profile menu carries
            Log out on every screen size. */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-10 w-10 rounded-full sm:inline-flex"
          onClick={() => { logout(); navigate("/login"); }}
          aria-label="Log out"
        >
          <LogOut className="h-5 w-5" />
        </Button>

        <ProfileMenu />
      </div>
    </header>
  );
}
