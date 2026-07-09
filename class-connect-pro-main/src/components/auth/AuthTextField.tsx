import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function AuthTextField({ id, label, icon: Icon, className, ...props }: AuthTextFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 dark:bg-accent/20 dark:text-accent dark:ring-accent/25">
          <Icon className="h-4 w-4 stroke-[2.4]" />
        </span>
        <Input
          id={id}
          className={`h-12 rounded-xl border-slate-200/80 bg-white/90 pl-12 text-slate-950 shadow-sm backdrop-blur-md transition-base placeholder:text-slate-500 focus-visible:bg-white focus-visible:ring-primary/30 dark:border-white/20 dark:bg-slate-950/80 dark:text-slate-50 dark:placeholder:text-slate-300 dark:focus-visible:bg-slate-900 ${className ?? ""}`}
          {...props}
        />
      </div>
    </div>
  );
}
