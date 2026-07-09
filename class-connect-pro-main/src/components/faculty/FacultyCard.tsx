import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";

import type { Faculty } from "@/data/faculties";

interface FacultyCardProps {
  faculty: Faculty;
}

export function FacultyCard({ faculty }: FacultyCardProps) {
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-background p-6 shadow-sm transition-base hover:-translate-y-1 hover:border-accent/70 hover:shadow-elegant">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-primary transition-base group-hover:bg-accent group-hover:text-accent-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        {faculty.shortName && (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
            {faculty.shortName}
          </span>
        )}
      </div>

      <h3 className="mt-6 font-heading text-xl font-bold text-foreground">{faculty.name}</h3>
      <p className="mt-3 flex-1 leading-7 text-muted-foreground">{faculty.description}</p>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-sm font-bold text-primary">
          {faculty.departments.length} departments
        </p>
        <Link
          to={`/faculty/${faculty.id}`}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-base hover:-translate-y-0.5 hover:bg-primary/90"
        >
          View Departments
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
