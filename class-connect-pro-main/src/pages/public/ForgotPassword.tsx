import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthTextField } from "@/components/auth/AuthTextField";
import { UniversityAuthShell } from "@/components/auth/UniversityAuthShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState<{ message: string; emailConfigured?: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.message || "Could not send the reset link. Please try again.");
      return;
    }
    setSent({ message: result.message || "", emailConfigured: result.emailConfigured });
  };

  return (
    <UniversityAuthShell
      eyebrow="Account recovery"
      title="Get back to your university portal."
      subtitle="We'll email you a link to choose a new password. The link works once and expires after 30 minutes."
    >
      <div className="mb-7">
        <Link
          to="/login"
          className="mb-5 inline-flex items-center gap-2 rounded-full text-sm font-bold text-slate-700 transition-base hover:text-primary dark:text-slate-200 dark:hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">Reset password</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-950 dark:text-slate-50">Recover your account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Enter your account email and we'll send you a secure link.
        </p>
      </div>

      {sent ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Check your email</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{sent.message}</p>
            </div>
          </div>

          {sent.emailConfigured === false && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-slate-800 dark:text-slate-200">
              Email delivery isn't set up on this server yet, so the link was written to the server log rather than
              sent. Ask an administrator to reset your password, or configure SMTP.
            </p>
          )}

          <Button asChild variant="outline" className="h-12 w-full rounded-xl font-bold">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthTextField
            id="email"
            label="Account email"
            icon={Mail}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-gradient-primary font-bold shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Email me a reset link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        Remembered it?{" "}
        <Link to="/login" className="font-bold text-primary transition-base hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">
          Sign in
        </Link>
      </p>
    </UniversityAuthShell>
  );
}
