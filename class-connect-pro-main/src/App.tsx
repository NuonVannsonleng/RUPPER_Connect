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
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import OAuthCallback from "./pages/OAuthCallback";
import Settings from "./pages/Settings";
import Home from "./pages/Home";
import FacultyDetail from "./pages/FacultyDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
                    <Route path="/attendance"     element={<Attendance />} />
                    <Route path="/gradebook"      element={<Gradebook />} />
                    <Route path="/schedule"       element={<Schedule />} />
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
