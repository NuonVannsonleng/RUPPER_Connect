import { Loader2 } from "lucide-react";

interface SyncStatusProps {
  label: string;
}

export function SyncStatus({ label }: SyncStatusProps) {
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      <span>Syncing {label} with backend...</span>
    </div>
  );
}
