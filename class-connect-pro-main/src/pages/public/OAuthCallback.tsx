import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function OAuthCallback() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [handled, setHandled] = useState(false);
  const error = searchParams.get("error");
  const token = searchParams.get("token");
  const rememberMe = searchParams.get("rememberMe") !== "false";

  const message = useMemo(
    () => error || "We could not complete social sign-in. Please try again.",
    [error]
  );

  useEffect(() => {
    if (handled) return;
    setHandled(true);

    if (error || !token) {
      setStatus("error");
      return;
    }

    completeOAuthLogin(token, rememberMe).then((ok) => {
      if (!ok) {
        setStatus("error");
        toast.error("Could not verify your social login session.");
        return;
      }

      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    });
  }, [completeOAuthLogin, error, handled, navigate, rememberMe, token]);

  return (
    <main className="flex min-h-screen items-center justify-center auth-bg px-4">
      <section className="w-full max-w-md rounded-[1.75rem] border border-white/30 bg-card/90 p-8 text-center shadow-elegant backdrop-blur-xl dark:bg-slate-950/80">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">
              Finishing secure sign-in
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Please wait while we connect your university account.
            </p>
          </>
        ) : (
          <>
            <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">
              Social login needs attention
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
            <Button asChild className="mt-6 rounded-xl">
              <Link to="/login">Back to login</Link>
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
