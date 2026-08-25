import { useState } from "react";
import { BarChart3, CheckCircle2, ChevronDown, Loader2, Trophy, Users, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { QuizResults, QuizResultsAttempt } from "@/data/academicPlatform";

interface QuizResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: QuizResults | null;
  isLoading?: boolean;
}

export function QuizResultsDialog({ open, onOpenChange, results, isLoading }: QuizResultsDialogProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const maxScore = results?.maxScore ?? 0;
  const averagePercent = maxScore > 0 ? Math.round(((results?.stats.averageScore ?? 0) / maxScore) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="truncate">{results?.quizTitle ?? "Results"}</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading || !results ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading results...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-6 grid gap-3 sm:grid-cols-4">
              <SummaryTile icon={Users} label="Attempts" value={results.stats.attemptCount} />
              <SummaryTile icon={BarChart3} label="Average" value={`${results.stats.averageScore}/${maxScore}`} />
              <SummaryTile icon={Trophy} label="Highest" value={`${results.stats.highestScore}/${maxScore}`} tone="success" />
              <SummaryTile icon={XCircle} label="Lowest" value={`${results.stats.lowestScore}/${maxScore}`} tone="warning" />
            </div>

            {results.stats.attemptCount > 0 && (
              <div className="mb-6 rounded-xl border border-border/60 bg-secondary/30 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Class average</span>
                  <span className="font-semibold tabular-nums text-primary">{averagePercent}%</span>
                </div>
                <Progress value={averagePercent} className="h-2" />
              </div>
            )}

            {results.attempts.length === 0 ? (
              <EmptyState icon={Users} title="No attempts yet" detail="Results appear here as students submit the quiz." />
            ) : (
              <div className="space-y-2">
                {results.attempts.map((attempt, index) => (
                  <AttemptRow
                    key={attempt.attemptId}
                    attempt={attempt}
                    index={index}
                    maxScore={maxScore}
                    isExpanded={expanded === attempt.attemptId}
                    onToggle={() => setExpanded((current) => (current === attempt.attemptId ? null : attempt.attemptId))}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AttemptRow({
  attempt,
  index,
  maxScore,
  isExpanded,
  onToggle,
}: {
  attempt: QuizResultsAttempt;
  index: number;
  maxScore: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const scoreOutOf = attempt.maxScore || maxScore;
  const percent = scoreOutOf > 0 ? Math.round((attempt.score / scoreOutOf) * 100) : 0;
  const tone = percent >= 80 ? "text-success" : percent >= 50 ? "text-warning" : "text-destructive";

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      className="animate-fade-in overflow-hidden rounded-xl border border-border/60 bg-card"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-base hover:bg-secondary/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
          {attempt.studentName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{attempt.studentName}</p>
          <p className="truncate text-xs text-muted-foreground">{attempt.studentEmail}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("font-display text-lg font-bold tabular-nums", tone)}>
            {attempt.score}
            <span className="text-sm text-muted-foreground">/{scoreOutOf}</span>
          </p>
          <p className="text-xs text-muted-foreground">{percent}%</p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-base", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="animate-fade-in space-y-2 border-t border-border/60 bg-secondary/20 px-4 py-3">
          {attempt.detail.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This attempt predates per-question review, so only the score was stored.
            </p>
          ) : (
            attempt.detail.map((item, itemIndex) => (
              <div key={item.questionId} className="flex items-start gap-2 text-sm">
                {item.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">
                    <span className="text-muted-foreground">{itemIndex + 1}. </span>
                    {item.question}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Answered <strong className={item.isCorrect ? "text-success" : "text-destructive"}>
                      {item.chosen ?? "nothing"}
                    </strong>
                    {!item.isCorrect && (
                      <>
                        {" "}- correct was <strong className="text-success">{item.correctAnswer}</strong>
                      </>
                    )}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {item.earned}/{item.points}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
      <Icon
        className={cn(
          "mb-2 h-4 w-4",
          tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary"
        )}
      />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
