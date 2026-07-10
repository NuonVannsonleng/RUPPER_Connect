import { useQuery } from "@tanstack/react-query";

import {
  academicAssignments,
  academicCalendarEvents,
  academicCourses,
  academicQuizzes,
  messageThreads,
  studentRiskAlerts,
  transcriptRecords,
  type AcademicAssignment,
  type AcademicCalendarEvent,
  type AcademicCourse,
  type AcademicQuiz,
  type MessageThread,
  type StudentAlert,
  type TranscriptRecord,
} from "@/data/academicPlatform";
import { apiRequest } from "@/lib/api";

export const ACADEMIC_COURSES_QUERY_KEY = ["academic", "courses"] as const;
export const ACADEMIC_ASSIGNMENTS_QUERY_KEY = ["academic", "assignments"] as const;
export const ACADEMIC_QUIZZES_QUERY_KEY = ["academic", "quizzes"] as const;
export const ACADEMIC_CALENDAR_QUERY_KEY = ["academic", "calendar"] as const;
export const ACADEMIC_TRANSCRIPT_QUERY_KEY = ["academic", "transcript"] as const;
export const ACADEMIC_MESSAGES_QUERY_KEY = ["academic", "messages"] as const;
export const ACADEMIC_RISK_ALERTS_QUERY_KEY = ["academic", "risk-alerts"] as const;

const withFallback = <T,>(rows: T[], fallback: T[]) => (rows.length ? rows : fallback);

export const fetchAcademicCourses = async () => {
  const rows = await apiRequest<AcademicCourse[]>("/academic/courses");
  return withFallback(rows, academicCourses);
};

export const fetchAcademicAssignments = async () => {
  const rows = await apiRequest<AcademicAssignment[]>("/academic/assignments");
  return withFallback(rows, academicAssignments);
};

export const fetchAcademicQuizzes = async () => {
  const rows = await apiRequest<AcademicQuiz[]>("/academic/quizzes");
  return withFallback(rows, academicQuizzes);
};

export const fetchAcademicCalendar = async () => {
  const rows = await apiRequest<AcademicCalendarEvent[]>("/academic/calendar");
  return withFallback(rows, academicCalendarEvents);
};

export const fetchAcademicTranscript = async () => {
  const rows = await apiRequest<TranscriptRecord[]>("/academic/transcript");
  return withFallback(rows, transcriptRecords);
};

export const fetchAcademicMessages = async () => {
  const rows = await apiRequest<MessageThread[]>("/academic/messages");
  return withFallback(rows, messageThreads);
};

export const fetchAcademicRiskAlerts = async () => {
  const rows = await apiRequest<StudentAlert[]>("/academic/risk-alerts");
  return withFallback(rows, studentRiskAlerts);
};

export function useAcademicCourses() {
  return useQuery({
    queryKey: ACADEMIC_COURSES_QUERY_KEY,
    queryFn: fetchAcademicCourses,
    initialData: academicCourses,
  });
}

export function useAcademicAssignments() {
  return useQuery({
    queryKey: ACADEMIC_ASSIGNMENTS_QUERY_KEY,
    queryFn: fetchAcademicAssignments,
    initialData: academicAssignments,
  });
}

export function useAcademicQuizzes() {
  return useQuery({
    queryKey: ACADEMIC_QUIZZES_QUERY_KEY,
    queryFn: fetchAcademicQuizzes,
    initialData: academicQuizzes,
  });
}

export function useAcademicCalendar() {
  return useQuery({
    queryKey: ACADEMIC_CALENDAR_QUERY_KEY,
    queryFn: fetchAcademicCalendar,
    initialData: academicCalendarEvents,
  });
}

export function useAcademicTranscript() {
  return useQuery({
    queryKey: ACADEMIC_TRANSCRIPT_QUERY_KEY,
    queryFn: fetchAcademicTranscript,
    initialData: transcriptRecords,
  });
}

export function useAcademicMessages() {
  return useQuery({
    queryKey: ACADEMIC_MESSAGES_QUERY_KEY,
    queryFn: fetchAcademicMessages,
    initialData: messageThreads,
  });
}

export function useAcademicRiskAlerts() {
  return useQuery({
    queryKey: ACADEMIC_RISK_ALERTS_QUERY_KEY,
    queryFn: fetchAcademicRiskAlerts,
    initialData: studentRiskAlerts,
  });
}
