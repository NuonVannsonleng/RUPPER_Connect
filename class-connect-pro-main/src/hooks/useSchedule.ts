import { useQuery } from "@tanstack/react-query";
import { schedule as fallbackSchedule } from "@/data/mockData";
import { apiRequest } from "@/lib/api";

export const SCHEDULE_QUERY_KEY = ["schedules"] as const;

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface ClassSession {
  id: string;
  day: string;
  time: string;
  subject: string;
  room: string;
  teacher: string;
  startTime: string;
  endTime: string;
  roleVisibility: "student" | "teacher" | "both";
}

export interface ApiSchedule {
  id: number | string;
  title: string;
  teacher?: string;
  room?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roleVisibility?: "student" | "teacher" | "both";
}

const fallbackSessions: ClassSession[] = fallbackSchedule.map((item) => {
  const [startTime, endTime] = item.time.split(" - ");
  return {
    id: item.id,
    day: item.day,
    time: item.time,
    subject: item.subject,
    room: item.room,
    teacher: item.teacher,
    startTime,
    endTime,
    roleVisibility: "both",
  };
});

export const formatSchedule = (item: ApiSchedule): ClassSession => ({
  id: String(item.id),
  day: item.dayOfWeek,
  time: `${item.startTime} - ${item.endTime}`,
  subject: item.title,
  room: item.room || "Room TBA",
  teacher: item.teacher || "Teacher TBA",
  startTime: item.startTime,
  endTime: item.endTime,
  roleVisibility: item.roleVisibility || "both",
});

const fetchSchedule = async () => {
  const rows = await apiRequest<ApiSchedule[]>("/schedules");
  return rows.map(formatSchedule);
};

export function useSchedule() {
  return useQuery({
    queryKey: SCHEDULE_QUERY_KEY,
    queryFn: fetchSchedule,
    initialData: fallbackSessions,
  });
}
