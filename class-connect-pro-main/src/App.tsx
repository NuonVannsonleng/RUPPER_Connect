import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { RoleProvider } from "@/context/RoleContext";
import { AuthProvider } from "@/context/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import GuestRoute from "@/components/auth/GuestRoute";
import { RouteTransition } from "@/components/shared/RouteTransition";

// Pages are grouped by who they belong to: public/ needs no account, user/ is shared by
// teachers and students, admin/ is administration only.
import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Signup from "./pages/public/Signup";
import ForgotPassword from "./pages/public/ForgotPassword";
import ResetPassword from "./pages/public/ResetPassword";
import OAuthCallback from "./pages/public/OAuthCallback";
import FacultyDetail from "./pages/public/FacultyDetail";
import NotFound from "./pages/public/NotFound";

import Dashboard from "./pages/user/Dashboard";
import Attendance from "./pages/user/Attendance";
import Gradebook from "./pages/user/Gradebook";
import Schedule from "./pages/user/Schedule";
import Announcements from "./pages/user/Announcements";
import Courses from "./pages/user/Courses";
import Assignments from "./pages/user/Assignments";
import Quizzes from "./pages/user/Quizzes";
import AcademicCalendar from "./pages/user/AcademicCalendar";
import Transcript from "./pages/user/Transcript";
import Messages from "./pages/user/Messages";
import Settings from "./pages/user/Settings";

import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import CourseOversight from "./pages/admin/CourseOversight";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Navigating remounts the page, and with the default staleTime of 0 that meant a
      // fresh network round-trip to the API on every single click - so each page sat on
      // its "Syncing..." state before showing anything. Serving cached data for 30s makes
      // revisiting a page instant; it still refetches in the background when stale, and
      // mutations keep calling invalidateQueries directly so writes show up immediately.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Several hooks seed `initialData` with demo/empty placeholders so the UI has
      // something to render on first paint. React Query otherwise treats that seed as a
      // freshly-fetched value, which combined with staleTime above meant the real request
      // was never sent and the placeholder stuck on screen. Dating it to the epoch marks
      // it stale immediately, so the first mount still fetches; only genuinely fetched
      // data gets the 30s cache window.
      initialDataUpdatedAt: 0,
      // The default 3 retries with backoff makes a genuinely failing request take many
      // seconds to fall back to an error state.
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <RoleProvider>
            <BrowserRouter>
              <RouteTransition>
                <Routes>
                  {/* Public routes. The first three send you on to your dashboard if you
                      already have a session - being asked to sign in again when you are
                      signed in is the thing that made the landing page feel like a wall. */}
                  <Route path="/" element={<GuestRoute><Home /></GuestRoute>} />
                  <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                  <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />

                  {/* Deliberately not guest-only: a stale session shouldn't block a reset. */}
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/oauth/callback" element={<OAuthCallback />} />
                  <Route path="/faculty/:facultyId" element={<FacultyDetail />} />

                  {/* Teacher + student area */}
                  <Route
                    element={
                      <ProtectedRoute allow={["teacher", "student"]}>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard"      element={<Dashboard />} />
                    <Route path="/courses"        element={<Courses />} />
                    <Route path="/assignments"    element={<Assignments />} />
                    <Route path="/quizzes"        element={<Quizzes />} />
                    <Route path="/attendance"     element={<Attendance />} />
                    <Route path="/gradebook"      element={<Gradebook />} />
                    <Route path="/schedule"       element={<Schedule />} />
                    <Route path="/calendar"       element={<AcademicCalendar />} />
                    <Route path="/transcript"     element={<Transcript />} />
                    <Route path="/messages"       element={<Messages />} />
                    <Route path="/announcements"  element={<Announcements />} />
                  </Route>

                  {/* Admin area */}
                  <Route
                    element={
                      <ProtectedRoute allow={["admin"]}>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/admin"          element={<AdminDashboard />} />
                    <Route path="/admin/users"    element={<UserManagement />} />
                    <Route path="/admin/courses"  element={<CourseOversight />} />
                  </Route>

                  {/* Everyone signed in manages their own profile and password here. */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RouteTransition>
            </BrowserRouter>
          </RoleProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
