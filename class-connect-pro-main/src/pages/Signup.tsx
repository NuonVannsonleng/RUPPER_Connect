import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth, UserRole } from "@/context/AuthContext";
import { toast } from "sonner";
import schoolLogo from "@/assets/school-logo.png";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const ok = await signup(name, email, password, role);
    setIsSubmitting(false);

    if (ok) {
      toast.success(`Account created! Welcome, ${name}`);
      navigate("/");
    } else {
      toast.error("An account with this email already exists");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg p-4">
      <Card className="w-full max-w-md border-0 bg-white/95 p-8 shadow-elegant backdrop-blur-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={schoolLogo} alt="RUPPER logo" className="mx-auto mb-3 h-24 w-24 rounded-full object-contain shadow-lg ring-4 ring-accent/30" />
          <h1 className="font-display text-3xl font-extrabold tracking-wide text-primary">RUPPER Connect</h1>
          <div className="mt-3 h-1 w-32 rounded-full bg-gradient-primary" />
          <h2 className="mt-4 font-display text-xl font-bold">Create your account</h2>
          <p className="text-sm text-muted-foreground">Connect - Learn - Succeed</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["student", "teacher"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-lg border p-3 text-sm font-semibold capitalize transition-base ${
                    role === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
