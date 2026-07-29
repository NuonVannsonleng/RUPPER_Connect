import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";

import { AuthTextField } from "@/components/auth/AuthTextField";
import { UniversityAuthShell } from "@/components/auth/UniversityAuthShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    const ok = await resetPassword(email, newPassword);
    setIsSubmitting(false);

    if (!ok) {
      toast.error("No account found with this email");
      return;
    }

    toast.success("Password reset successfully. Please sign in again.");
    navigate("/login");
  };

  return (
    <UniversityAuthShell
      eyebrow="Account recovery"
      title="Get back to your university portal."
      subtitle="Reset your student or teacher password and return to your connected academic workspace."
    >
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">Reset password</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-950 dark:text-slate-50">Recover your account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Enter your account email and choose a new secure password.
        </p>
      </div>

      {/* Matched on email alone - the account's role isn't something you should have to
          state to recover it, and admins have no button here to pick anyway. */}
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

        <AuthTextField
          id="newPassword"
          label="New password"
          icon={LockKeyhole}
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 6 characters"
        />

        <AuthTextField
          id="confirmPassword"
          label="Confirm password"
          icon={LockKeyhole}
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat your new password"
        />

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-gradient-primary font-bold shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Resetting..." : "Reset password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        Remember your password?{" "}
        <Link to="/login" className="font-bold text-primary transition-base hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">
          Sign in
        </Link>
      </p>
    </UniversityAuthShell>
  );
}
