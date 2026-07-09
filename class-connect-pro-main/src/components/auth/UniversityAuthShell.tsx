import type { ReactNode } from "react";
import { BookOpenCheck, CalendarDays, Megaphone, MessageCircle } from "lucide-react";

import campusBg from "@/assets/rupp-campus-bg.png";
import schoolLogo from "@/assets/school-logo.png";

interface UniversityAuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

const features = [
  { label: "Class schedule management", icon: CalendarDays },
  { label: "Student communication", icon: MessageCircle },
  { label: "Learning resources", icon: BookOpenCheck },
  { label: "University announcements", icon: Megaphone },
];

export function UniversityAuthShell({ eyebrow, title, subtitle, children }: UniversityAuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center auth-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/25 bg-white/10 shadow-elegant backdrop-blur-xl animate-fade-in dark:border-white/10 dark:bg-slate-950/35 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative min-h-[30rem] overflow-hidden p-6 text-white sm:p-8 lg:min-h-[42rem] lg:p-10">
          <img
            src={campusBg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-primary/75 to-black/30" />
          <div className="absolute -left-20 top-14 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-white/20 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="animate-float-soft rounded-3xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <img
                  src={schoolLogo}
                  alt="University logo"
                  className="h-16 w-16 rounded-full object-contain shadow-lg ring-4 ring-white/25"
                />
                <div>
                  <p className="font-heading text-2xl font-bold">RUPPER Connect</p>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                    University Portal
                  </p>
                </div>
              </div>

              <div className="mt-10 max-w-md">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
                <h1 className="mt-3 font-heading text-4xl font-bold leading-tight sm:text-5xl">
                  {title}
                </h1>
                <p className="mt-4 text-base leading-7 text-white/80">{subtitle}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((feature, index) => (
                <div
                  key={feature.label}
                  className="animate-fade-in rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-lg transition-base hover:-translate-y-1 hover:bg-white/20"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <feature.icon className="mb-3 h-5 w-5 text-accent" />
                  <p className="text-sm font-semibold leading-6 text-white">{feature.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white/20 p-5 dark:bg-slate-950/30 sm:p-8 lg:p-10">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/60 bg-white/80 p-6 shadow-elegant backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/80 sm:p-8">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
