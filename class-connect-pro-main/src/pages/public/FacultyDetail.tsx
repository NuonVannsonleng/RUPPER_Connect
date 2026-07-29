import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2 } from "lucide-react";

import { DepartmentList } from "@/components/faculty/DepartmentList";
import { Button } from "@/components/ui/button";
import { getFacultyById } from "@/data/faculties";
import campusBg from "@/assets/rupp-campus-bg.webp";
import schoolLogo from "@/assets/school-logo.webp";

export default function FacultyDetail() {
  const { facultyId } = useParams();
  const faculty = getFacultyById(facultyId);

  if (!faculty) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <section className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
          <Building2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">Faculty not found</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This faculty page does not exist yet.
          </p>
          <Button asChild className="mt-6 rounded-xl">
            <Link to="/#faculties">Back to faculties</Link>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section
        className="relative overflow-hidden bg-cover bg-center px-5 pb-16 pt-8 md:px-8"
        style={{ backgroundImage: `url(${campusBg})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/65 to-transparent" />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 text-white">
              <img src={schoolLogo} alt="University logo" className="h-11 w-11 rounded-full object-contain" />
              <span className="font-heading text-lg font-bold">RUPPER Connect</span>
            </Link>
            <Button asChild variant="secondary" className="rounded-full">
              <Link to="/#faculties">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Faculties
              </Link>
            </Button>
          </div>

          <div className="mt-24 max-w-3xl animate-fade-in text-white">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Faculty</p>
            <h1 className="mt-3 font-heading text-4xl font-bold leading-tight md:text-6xl">
              {faculty.name}
            </h1>
            <p className="mt-5 text-lg leading-8 text-white/80">{faculty.description}</p>
            <div className="mt-7 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur-md">
              {faculty.departments.length} departments
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-primary">
              Departments
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground">
              Academic departments in {faculty.shortName || faculty.name}
            </h2>
          </div>
          <DepartmentList departments={faculty.departments} />
        </div>
      </section>
    </main>
  );
}
