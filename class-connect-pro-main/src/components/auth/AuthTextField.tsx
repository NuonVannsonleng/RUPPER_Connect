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
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary drop-shadow-sm dark:text-accent" strokeWidth={3} />
        <Input
          id={id}
          className={`h-12 rounded-xl border-slate-200/80 bg-white/90 pl-12 text-slate-950 shadow-sm backdrop-blur-md transition-base placeholder:text-slate-500 focus-visible:bg-white focus-visible:ring-primary/30 dark:border-white/20 dark:bg-slate-950/80 dark:text-slate-50 dark:placeholder:text-slate-300 dark:focus-visible:bg-slate-900 ${className ?? ""}`}
          {...props}
        />
      </div>
    </div>
  );
}
