import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const ATTENDANCE_SUMMARY_QUERY_KEY = ["attendance", "summary"] as const;
export const ATTENDANCE_CLASS_SUMMARY_QUERY_KEY = ["attendance", "class-summary"] as const;

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

const EMPTY_SUMMARY: AttendanceSummary = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };

const fetchAttendanceSummary = () => apiRequest<AttendanceSummary>("/attendance/summary");
const fetchClassAttendanceSummary = () => apiRequest<AttendanceSummary>("/attendance/class-summary");

export function useAttendanceSummary() {
  return useQuery({
    queryKey: ATTENDANCE_SUMMARY_QUERY_KEY,
    queryFn: fetchAttendanceSummary,
    initialData: EMPTY_SUMMARY,
  });
}

export function useClassAttendanceSummary() {
  return useQuery({
    queryKey: ATTENDANCE_CLASS_SUMMARY_QUERY_KEY,
    queryFn: fetchClassAttendanceSummary,
    initialData: EMPTY_SUMMARY,
  });
}
