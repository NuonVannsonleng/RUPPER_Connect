import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <Card className="mb-6 overflow-hidden border-0 campus-hero-bg p-5 text-primary-foreground shadow-elegant sm:mb-8 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-2xl font-bold text-primary-foreground sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80 sm:text-base">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/10 p-1.5 backdrop-blur-sm">
            {actions}
          </div>
        )}
      </div>
    </Card>
  );
}
