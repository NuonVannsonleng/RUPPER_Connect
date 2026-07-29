import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { UserRole } from "@/context/AuthContext";

export const ADMIN_STATS_QUERY_KEY = ["admin", "stats"] as const;
export const ADMIN_USERS_QUERY_KEY = ["admin", "users"] as const;
export const ADMIN_COURSES_QUERY_KEY = ["admin", "courses"] as const;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  major?: string;
  year?: string;
  department?: string;
  createdAt?: string;
}

export interface AdminStats {
  users: { total: number; student: number; teacher: number; admin: number };
  courses: number;
  assignments: number;
  quizzes: number;
  announcements: number;
  attendanceRecords: number;
  recentUsers: AdminUser[];
}

export interface AdminCourse {
  id: string;
  code: string;
  title: string;
  faculty: string;
  department: string;
  semester: string;
  status: string;
  lecturerId: string;
  lecturerName: string;
  students: number;
}

const EMPTY_STATS: AdminStats = {
  users: { total: 0, student: 0, teacher: 0, admin: 0 },
  courses: 0,
  assignments: 0,
  quizzes: 0,
  announcements: 0,
  attendanceRecords: 0,
  recentUsers: [],
};

export const ADMIN_EMAIL_DIAGNOSTICS_QUERY_KEY = ["admin", "email-diagnostics"] as const;

export interface EmailDiagnostics {
  configured: boolean;
  from: string | null;
  host: string | null;
  port: number;
  ok: boolean;
  error: string | null;
  code: string | null;
  hint: string | null;
}

export function useEmailDiagnostics() {
  return useQuery({
    queryKey: ADMIN_EMAIL_DIAGNOSTICS_QUERY_KEY,
    queryFn: () => apiRequest<EmailDiagnostics>("/admin/email-diagnostics"),
    // Verifying opens a real SMTP connection, so don't refire it on every visit.
    staleTime: 5 * 60_000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ADMIN_STATS_QUERY_KEY,
    queryFn: () => apiRequest<AdminStats>("/admin/stats"),
    initialData: EMPTY_STATS,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ADMIN_USERS_QUERY_KEY,
    queryFn: () => apiRequest<AdminUser[]>("/admin/users"),
    initialData: [],
  });
}

export function useAdminCourses() {
  return useQuery({
    queryKey: ADMIN_COURSES_QUERY_KEY,
    queryFn: () => apiRequest<AdminCourse[]>("/admin/courses"),
    initialData: [],
  });
}
