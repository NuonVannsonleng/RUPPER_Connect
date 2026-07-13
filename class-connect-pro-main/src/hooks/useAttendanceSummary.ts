import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const ATTENDANCE_SUMMARY_QUERY_KEY = ["attendance", "summary"] as const;

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

const EMPTY_SUMMARY: AttendanceSummary = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };

const fetchAttendanceSummary = () => apiRequest<AttendanceSummary>("/attendance/summary");

export function useAttendanceSummary() {
  return useQuery({
    queryKey: ATTENDANCE_SUMMARY_QUERY_KEY,
    queryFn: fetchAttendanceSummary,
    initialData: EMPTY_SUMMARY,
  });
}
