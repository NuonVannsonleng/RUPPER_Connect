import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { landingPathFor } from "@/lib/routes";

interface ProtectedRouteProps {
  children: JSX.Element;
  /** When set, only these roles may enter; anyone else is bounced to their own dashboard. */
  allow?: UserRole[];
}

export default function ProtectedRoute({ children, allow }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-muted-foreground">
        Loading your workspace...
      </div>
    );
  }

  // Carry the attempted URL through sign-in. A student who scans the attendance QR while
  // signed out would otherwise land on the dashboard with the code silently dropped.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // Guarding here as well as on the server: this only tidies up the UI, the API is what
  // actually enforces access.
  if (allow && !allow.includes(user.role)) {
    return <Navigate to={landingPathFor(user.role)} replace />;
  }

  return children;
}
