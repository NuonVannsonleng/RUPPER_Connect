import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadErrorProps {
  label: string;
  error?: unknown;
  onRetry?: () => void;
}

/**
 * Shown when a request fails, so a failure never gets mistaken for a genuinely empty
 * list - "No accounts yet" and "we couldn't reach the server" look identical otherwise.
 */
export function LoadError({ label, error, onRetry }: LoadErrorProps) {
  const detail = error instanceof Error ? error.message : undefined;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Could not load {label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {detail || "The server did not respond. Check your connection and try again."}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
