import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/api";
import { landingPathFor } from "@/lib/routes";

/**
 * Wraps pages that only make sense when signed out. Someone with a session who opens the
 * site root or the login form was being shown the marketing page and then asked for a
 * password they had already given; they now go straight to their dashboard.
 *
 * Not used on the password reset pages: a stale session shouldn't stop somebody redeeming a
 * reset link.
 */
export default function GuestRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  // Only wait while there is a stored session worth checking. A first-time visitor has no
  // token, so they get the page immediately rather than a loading screen.
  if (loading && getToken()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (user) return <Navigate to={landingPathFor(user.role)} replace />;

  return children;
}
