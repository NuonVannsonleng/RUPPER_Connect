import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { AuthTextField } from "@/components/auth/AuthTextField";
import { UniversityAuthShell } from "@/components/auth/UniversityAuthShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const MIN_LENGTH = 8;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { resetPasswordWithToken } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < MIN_LENGTH) {
      toast.error(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    const result = await resetPasswordWithToken(token, newPassword);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.message || "This reset link is invalid or has expired.");
      return;
    }

    toast.success(result.message || "Password updated. Please sign in.");
    navigate("/login");
  };

  return (
    <UniversityAuthShell
      eyebrow="Account recovery"
      title="Choose a new password."
      subtitle="Pick something you don't use anywhere else. Signing in again afterwards will end any other sessions on your account."
    >
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">New password</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-950 dark:text-slate-50">Set your password</h1>
      </div>

      {!token ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">This link is incomplete</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                Open the link from your email exactly as it was sent, or request a new one.
              </p>
            </div>
          </div>
          <Button asChild className="h-12 w-full rounded-xl bg-gradient-primary font-bold">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthTextField
            id="new-password"
            label="New password"
            icon={LockKeyhole}
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`At least ${MIN_LENGTH} characters`}
          />
          <AuthTextField
            id="confirm-password"
            label="Confirm new password"
            icon={LockKeyhole}
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
          />

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-gradient-primary font-bold shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update password"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        <Link to="/login" className="font-bold text-primary transition-base hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">
          Back to sign in
        </Link>
      </p>
    </UniversityAuthShell>
  );
}
