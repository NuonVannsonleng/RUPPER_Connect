import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, MailCheck } from "lucide-react";

import { UniversityAuthShell } from "@/components/auth/UniversityAuthShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

type Status = "confirming" | "success" | "error";

export default function ConfirmEmailChange() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { confirmEmailChange, user } = useAuth();
  const [status, setStatus] = useState<Status>(token ? "confirming" : "error");
  const [message, setMessage] = useState("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (!token || ranRef.current) return;
    ranRef.current = true;

    confirmEmailChange(token).then((result) => {
      setStatus(result.ok ? "success" : "error");
      setMessage(result.message || (result.ok ? "" : "This confirmation link is invalid or has expired."));
    });
  }, [token, confirmEmailChange]);

  return (
    <UniversityAuthShell
      eyebrow="Account security"
      title="Confirming your new email."
      subtitle="Opening this link is what proves the new address is really yours."
    >
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">Email change</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-950 dark:text-slate-50">Confirm email</h1>
      </div>

      {!token ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">This link is incomplete</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                Open the link from your email exactly as it was sent, or request a new one from Settings.
              </p>
            </div>
          </div>
          <Button asChild className="h-12 w-full rounded-xl bg-gradient-primary font-bold">
            <Link to="/settings">Go to Settings</Link>
          </Button>
        </div>
      ) : status === "confirming" ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-slate-700 dark:text-slate-300">Confirming your new email address...</p>
        </div>
      ) : status === "success" ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Email updated</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                {user
                  ? `You're signed in as ${user.email}.`
                  : "Your sign-in email has changed. Use the new address next time you sign in."}
              </p>
            </div>
          </div>
          <Button asChild className="h-12 w-full rounded-xl bg-gradient-primary font-bold">
            <Link to="/dashboard">
              <MailCheck className="mr-2 h-4 w-4" />
              Continue
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Could not confirm this change</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{message}</p>
            </div>
          </div>
          <Button asChild className="h-12 w-full rounded-xl bg-gradient-primary font-bold">
            <Link to="/settings">Back to Settings</Link>
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        <Link to="/login" className="font-bold text-primary transition-base hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">
          Back to sign in
        </Link>
      </p>
    </UniversityAuthShell>
  );
}
