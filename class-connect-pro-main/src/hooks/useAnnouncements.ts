import { useQuery } from "@tanstack/react-query";
import { announcements as fallbackAnnouncements, Announcement } from "@/data/mockData";
import { apiRequest } from "@/lib/api";

export const ANNOUNCEMENTS_QUERY_KEY = ["announcements"] as const;

export interface ApiAnnouncement {
  id: number | string;
  title: string;
  content: string;
  category?: string;
  createdAt?: string;
  author?: string;
  isRead?: boolean;
}

const categories: Announcement["category"][] = ["exam", "event", "general", "urgent"];

const isCategory = (value: string | undefined): value is Announcement["category"] =>
  Boolean(value && categories.includes(value as Announcement["category"]));

const formatDate = (value?: string) => {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const formatAnnouncement = (item: ApiAnnouncement): Announcement => ({
  id: String(item.id),
  title: item.title,
  body: item.content,
  author: item.author || "Academic Office",
  date: formatDate(item.createdAt),
  category: isCategory(item.category) ? item.category : "general",
  isRead: item.isRead ?? false,
});

const fetchAnnouncements = async () => {
  const rows = await apiRequest<ApiAnnouncement[]>("/announcements");
  return rows.map(formatAnnouncement);
};

export function useAnnouncements() {
  return useQuery({
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    queryFn: fetchAnnouncements,
    initialData: fallbackAnnouncements,
  });
}
