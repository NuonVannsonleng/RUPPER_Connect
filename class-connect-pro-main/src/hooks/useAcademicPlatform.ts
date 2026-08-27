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
  type QuizDetail,
  type QuizResults,
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
export const ACADEMIC_CONTACTS_QUERY_KEY = ["academic", "contacts"] as const;
export const ACADEMIC_CONVERSATIONS_QUERY_KEY = ["academic", "conversations"] as const;
export const academicThreadQueryKey = (userId: string) => ["academic", "thread", userId] as const;

export type DirectoryRole = "admin" | "teacher" | "student";

export interface AcademicContact {
  id: string;
  name: string;
  email: string;
  role: DirectoryRole;
  avatar?: string;
}

/** A person you have messages with, plus the preview the conversation list shows. */
export interface Conversation {
  userId: string;
  name: string;
  role: DirectoryRole;
  avatar?: string;
  lastMessage: string;
  lastAt: string;
  lastFromMe: boolean;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  body: string;
  sentAt: string;
  fromMe: boolean;
}

export interface ChatThread {
  person: AcademicContact;
  messages: ChatMessage[];
}

// Falls back to demo data only when the backend request itself fails (e.g. offline),
// never when it succeeds with a legitimately empty list - otherwise a real empty
// state (0 messages, 0 courses, ...) would be permanently masked by fake demo rows.
const withFallback = async <T,>(fetcher: () => Promise<T[]>, fallback: T[]): Promise<T[]> => {
  try {
    return await fetcher();
  } catch {
    return fallback;
  }
};

export const fetchAcademicCourses = () => withFallback(() => apiRequest<AcademicCourse[]>("/academic/courses"), academicCourses);

export const fetchAcademicAssignments = () =>
  withFallback(() => apiRequest<AcademicAssignment[]>("/academic/assignments"), academicAssignments);

export const fetchAcademicQuizzes = () => withFallback(() => apiRequest<AcademicQuiz[]>("/academic/quizzes"), academicQuizzes);

export const fetchAcademicCalendar = () =>
  withFallback(() => apiRequest<AcademicCalendarEvent[]>("/academic/calendar"), academicCalendarEvents);

export const fetchAcademicTranscript = () =>
  withFallback(() => apiRequest<TranscriptRecord[]>("/academic/transcript"), transcriptRecords);

export const fetchAcademicMessages = () => withFallback(() => apiRequest<MessageThread[]>("/academic/messages"), messageThreads);

export const fetchAcademicRiskAlerts = () =>
  withFallback(() => apiRequest<StudentAlert[]>("/academic/risk-alerts"), studentRiskAlerts);

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

/**
 * A single quiz with its questions. No demo fallback and no cache reuse: the answer key is only
 * present for teachers, and a student's copy is stripped server-side, so a stale entry handed to
 * the wrong role would be both wrong and a leak. `enabled` keeps it idle until a dialog opens.
 */
export function useQuizDetail(quizId: string | null) {
  return useQuery({
    queryKey: ["academic", "quiz", quizId] as const,
    queryFn: () => apiRequest<QuizDetail>(`/academic/quizzes/${quizId}`),
    enabled: Boolean(quizId),
    gcTime: 0,
    staleTime: 0,
  });
}

export function useQuizResults(quizId: string | null) {
  return useQuery({
    queryKey: ["academic", "quiz-results", quizId] as const,
    queryFn: () => apiRequest<QuizResults>(`/academic/quizzes/${quizId}/results`),
    enabled: Boolean(quizId),
    gcTime: 0,
    staleTime: 0,
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

/**
 * Polling stands in for a socket here. The backend is a plain REST service on a free
 * instance, so a WebSocket would need infrastructure this app does not have.
 *
 * Three defaults have to be overridden for a chat, and all three were why a reply only
 * appeared after navigating away and back:
 *
 *  - refetchIntervalInBackground is false by default, so the interval stops the moment the
 *    tab loses focus. Testing two accounts in two windows means the one you are not looking
 *    at never polls at all.
 *  - the app-wide staleTime of 30s applies to focus refetches too, so even clicking back
 *    into the tab did nothing for the first half minute.
 *  - the interval itself was too slow to read as live.
 *
 * Only a full navigation remounted the query and forced a fetch, which is the behaviour that
 * got reported.
 */
const CHAT_QUERY_OPTIONS = {
  staleTime: 0,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
  refetchOnMount: true,
} as const;

export function useConversations() {
  return useQuery({
    ...CHAT_QUERY_OPTIONS,
    queryKey: ACADEMIC_CONVERSATIONS_QUERY_KEY,
    queryFn: () => apiRequest<Conversation[]>("/academic/messages/conversations"),
    initialData: [],
    refetchInterval: 6000,
  });
}

export function useChatThread(userId: string | null) {
  return useQuery({
    ...CHAT_QUERY_OPTIONS,
    queryKey: academicThreadQueryKey(userId ?? "none"),
    queryFn: () => apiRequest<ChatThread>(`/academic/messages/thread/${userId}`),
    enabled: Boolean(userId),
    // The open conversation is what someone is actually watching, so it polls fastest.
    refetchInterval: 3000,
  });
}

export function useAcademicContacts() {
  return useQuery({
    queryKey: ACADEMIC_CONTACTS_QUERY_KEY,
    queryFn: () => apiRequest<AcademicContact[]>("/academic/contacts"),
    initialData: [],
  });
}
