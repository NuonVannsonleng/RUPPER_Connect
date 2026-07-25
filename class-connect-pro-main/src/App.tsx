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
import { RouteTransition } from "@/components/shared/RouteTransition";

import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import Gradebook from "./pages/Gradebook";
import Schedule from "./pages/Schedule";
import Announcements from "./pages/Announcements";
import Courses from "./pages/Courses";
import Assignments from "./pages/Assignments";
import Quizzes from "./pages/Quizzes";
import AcademicCalendar from "./pages/AcademicCalendar";
import Transcript from "./pages/Transcript";
import Messages from "./pages/Messages";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import OAuthCallback from "./pages/OAuthCallback";
import Settings from "./pages/Settings";
import Home from "./pages/Home";
import FacultyDetail from "./pages/FacultyDetail";
import NotFound from "./pages/NotFound";

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
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/oauth/callback" element={<OAuthCallback />} />
                  <Route path="/faculty/:facultyId" element={<FacultyDetail />} />

                  {/* Protected app routes */}
                  <Route
                    element={
                      <ProtectedRoute>
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
                    <Route path="/settings"       element={<Settings />} />
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
