import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, LockKeyhole, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

import { AuthTextField } from "@/components/auth/AuthTextField";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { UniversityAuthShell } from "@/components/auth/UniversityAuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OAuthProvider, useAuth, UserRole } from "@/context/AuthContext";

export default function Login() {
  const { login, startOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const handleSocialLogin = (provider: OAuthProvider, label: string) => {
    setActiveProvider(label);
    startOAuthLogin(provider, role, rememberMe);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const ok = await login(email, password, role, rememberMe);
    setIsSubmitting(false);

    if (ok) {
      toast.success("Welcome back!");
      navigate("/dashboard");
    } else {
      toast.error("Invalid credentials or wrong role");
    }
  };

  return (
    <UniversityAuthShell
      eyebrow="Welcome back"
      title="A smarter campus starts here."
      subtitle="Access your classes, announcements, schedules, and academic tools through one connected university platform."
    >
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">Secure login</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-950 dark:text-slate-50">Sign in to RUPPER Connect</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Use your university account to continue to your dashboard.
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
              className="border-primary/40 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <Label htmlFor="remember" className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Remember me
            </Label>
          </div>
          <Link to="/forgot-password" className="text-sm font-bold text-primary transition-base hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-gradient-primary font-bold shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant"
          disabled={isSubmitting || Boolean(activeProvider)}
        >
          {isSubmitting ? "Signing in..." : activeProvider ? `Opening ${activeProvider}...` : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border/70" />
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">or</span>
        <div className="h-px flex-1 bg-border/70" />
      </div>

      <SocialLoginButtons onProviderSelect={handleSocialLogin} disabled={isSubmitting || Boolean(activeProvider)} />

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-bold text-primary transition-base hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">
          Sign up
        </Link>
      </p>
    </UniversityAuthShell>
  );
}
