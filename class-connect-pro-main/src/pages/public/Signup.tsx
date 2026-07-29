import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, LockKeyhole, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

import { AuthTextField } from "@/components/auth/AuthTextField";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { UniversityAuthShell } from "@/components/auth/UniversityAuthShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OAuthProvider, useAuth, UserRole } from "@/context/AuthContext";

export default function Signup() {
  const { signup, startOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const handleSocialLogin = (provider: OAuthProvider, label: string) => {
    setActiveProvider(label);
    startOAuthLogin(provider, role, true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const ok = await signup(name, email, password, role);
    setIsSubmitting(false);

    if (ok) {
      toast.success(`Account created! Welcome, ${name}`);
      navigate("/dashboard");
    } else {
      toast.error("An account with this email already exists");
    }
  };

  return (
    <UniversityAuthShell
      eyebrow="Join the portal"
      title="Create your academic workspace."
      subtitle="Set up a student or teacher account and start managing schedules, communication, and learning activity in one place."
    >
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">Create account</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-950 dark:text-slate-50">Start with RUPPER Connect</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Choose your role and create your university portal profile.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">I am a</Label>
          <div className="grid grid-cols-2 gap-3">
            {(["student", "teacher"] as const).map((item) => {
              const Icon = item === "student" ? GraduationCap : UserRound;
              const active = role === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRole(item)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold capitalize shadow-sm backdrop-blur-md transition-base hover:-translate-y-0.5 ${
                    active
                      ? "border-primary/40 bg-primary text-primary-foreground shadow-glow"
                      : "border-slate-200/80 bg-white/90 text-slate-700 hover:border-primary/30 hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <AuthTextField
          id="name"
          label="Full name"
          icon={UserRound}
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
        />

        <AuthTextField
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <AuthTextField
          id="password"
          label="Password"
          icon={LockKeyhole}
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-gradient-primary font-bold shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant"
          disabled={isSubmitting || Boolean(activeProvider)}
        >
          {isSubmitting ? "Creating account..." : activeProvider ? `Opening ${activeProvider}...` : "Create account"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border/70" />
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">or</span>
        <div className="h-px flex-1 bg-border/70" />
      </div>

      <SocialLoginButtons onProviderSelect={handleSocialLogin} disabled={isSubmitting || Boolean(activeProvider)} />

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-primary transition-base hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">
          Sign in
        </Link>
      </p>
    </UniversityAuthShell>
  );
}
