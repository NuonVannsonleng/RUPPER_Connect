import { BookOpenCheck } from "lucide-react";

interface DepartmentListProps {
  departments: string[];
}

export function DepartmentList({ departments }: DepartmentListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {departments.map((department) => (
        <div
          key={department}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-base hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-primary">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          <p className="font-semibold text-foreground">{department}</p>
        </div>
      ))}
    </div>
  );
}
