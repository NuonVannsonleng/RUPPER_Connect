import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const NOTIFICATION_READS_QUERY_KEY = ["notifications", "reads"] as const;

const fetchNotificationReadKeys = () => apiRequest<string[]>("/notifications/read");

export function useNotificationReads() {
  return useQuery({
    queryKey: NOTIFICATION_READS_QUERY_KEY,
    queryFn: fetchNotificationReadKeys,
    initialData: [] as string[],
  });
}
