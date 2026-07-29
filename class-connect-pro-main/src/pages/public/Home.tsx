import { Link } from "react-router-dom";
import {
  ArrowRight,
  Facebook,
  Linkedin,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { FacultyCard } from "@/components/faculty/FacultyCard";
import { ThemeModeToggle } from "@/components/shared/ThemeModeToggle";
import { faculties } from "@/data/faculties";
import campusBg from "@/assets/rupp-campus-bg.webp";
import schoolLogo from "@/assets/school-logo.webp";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Faculties", href: "#faculties" },
  { label: "Contact", href: "#contact" },
  { label: "Support", href: "#support" },
];

const supportItems = [
  "Guided classroom management",
  "Secure student and teacher access",
  "Central announcements and schedules",
];

const Home = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="relative z-50 border-b border-border/60 bg-background/95 shadow-sm backdrop-blur-xl md:fixed md:inset-x-0 md:top-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 md:h-20 md:flex-row md:items-center md:justify-between md:px-8">
          <a href="#home" className="flex items-center gap-3">
            <img src={schoolLogo} alt="University logo" className="h-12 w-12 rounded-full object-contain" />
            <div className="leading-tight">
              <p className="font-heading text-lg font-bold text-primary">RUPPER Connect</p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                University Portal
              </p>
            </div>
          </a>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-muted-foreground">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-full px-1 py-2 transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeModeToggle />
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-base hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg"
            >
              Enter Portal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section
        id="home"
        className="relative min-h-[92vh] overflow-hidden bg-cover bg-center pt-12 md:pt-28"
        style={{ backgroundImage: `url(${campusBg})` }}
      >
        <div className="absolute inset-0 bg-black/62" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/60 to-transparent" />

        <div className="relative mx-auto flex min-h-[calc(92vh-7rem)] max-w-7xl items-center px-5 pb-16 md:px-8">
          <div className="max-w-3xl animate-fade-in text-white">
            <p className="mb-5 inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-md">
              Professional academic technology for 2026
            </p>
            <h1 className="font-heading text-5xl font-bold leading-tight md:text-7xl">
              University Learning Portal
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 md:text-xl">
              A clean digital campus workspace for attendance, grades, schedules,
              announcements, and daily academic coordination.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-foreground shadow-lg transition-base hover:-translate-y-0.5 hover:bg-white"
              >
                Sign in to dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#faculties"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-base hover:-translate-y-0.5 hover:bg-white hover:text-primary"
              >
                Explore faculties
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="bg-background py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[1fr_1.1fr] md:items-center md:px-8">
          <div className="animate-fade-in">
            <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-primary">About</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-primary md:text-5xl">
              Built for modern university learning.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-muted-foreground md:text-lg">
            <p>
              RUPPER Connect helps students and teachers stay aligned through one
              calm, reliable academic portal. It keeps essential classroom data
              visible without making the experience feel crowded.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Fast", "Daily records are easy to find."],
                ["Clear", "Information is grouped by task."],
                ["Secure", "Role-based access keeps data focused."],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm">
                  <p className="font-heading text-lg font-bold text-primary">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faculties" className="bg-card py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="max-w-2xl animate-fade-in">
            <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-primary">Faculties</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-primary md:text-5xl">
              Royal University of Phnom Penh Faculties
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Explore faculties, departments, and academic programs at RUPP.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {faculties.map((faculty) => (
              <FacultyCard key={faculty.id} faculty={faculty} />
            ))}
          </div>
        </div>
      </section>

      <section id="support" className="bg-background py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8">
          <div className="animate-fade-in">
            <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-primary">Support</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-primary md:text-5xl">
              Support for students, teachers, and administrators.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              The portal is designed for everyday campus use, with simple support
              paths and predictable tools for the people who manage learning.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-card p-7 shadow-sm">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-4">
              {supportItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  <p className="font-semibold text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="bg-card py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="rounded-[2rem] bg-gradient-primary px-6 py-12 text-primary-foreground shadow-xl md:px-12">
            <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
              <div>
                <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-accent">Contact</p>
                <h2 className="mt-3 font-heading text-3xl font-bold md:text-5xl">
                  Ready for a connected academic day?
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-primary-foreground/80">
                  Sign in to access your classroom dashboard, review announcements,
                  and manage the information that keeps learning moving.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-primary transition-base hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
                >
                  Open portal
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:support@rupp.edu.kh"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition-base hover:-translate-y-0.5 hover:bg-white hover:text-primary"
                >
                  <Mail className="h-4 w-4" />
                  Email support
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-foreground py-12 text-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 md:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <a href="#home" className="flex items-center gap-3">
              <img src={schoolLogo} alt="University logo" className="h-12 w-12 rounded-full object-contain" />
              <div>
                <p className="font-heading text-lg font-bold">RUPPER Connect</p>
                <p className="text-sm text-background/70">University Learning Portal</p>
              </div>
            </a>

            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-background/70">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href} className="transition-colors hover:text-accent">
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <a
                href="https://www.facebook.com"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 transition-base hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://www.linkedin.com"
                aria-label="LinkedIn"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 transition-base hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="mailto:support@rupp.edu.kh"
                aria-label="Email"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 transition-base hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="border-t border-background/10 pt-6 text-sm text-background/60">
            &copy; 2026 University Learning Portal
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Home;
