import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";
import { apiRequest } from "@/lib/api";
import {
  GRADEBOOK_COLUMNS,
  GRADEBOOK_QUERY_KEY,
  GRADEBOOK_SUBJECT,
  GradeMap,
  calculateStudentAverages,
  gradeKey,
  useGradebook,
  useGradebookRoster,
} from "@/hooks/useGradebook";

export default function Gradebook() {
  const { role } = useRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: gradeMap = {}, isFetching: isFetchingGrades } = useGradebook();
  const { data: roster = [], isFetching: isFetchingRoster } = useGradebookRoster();
  const [draft, setDraft] = useState<GradeMap | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const workingMap = draft ?? gradeMap;
  const isLoading = isFetchingGrades || isFetchingRoster;

  const setScore = (studentId: string, columnId: string, raw: string) => {
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setDraft({ ...workingMap, [gradeKey(studentId, columnId)]: num });
  };

  const studentAverages = useMemo(() => calculateStudentAverages(workingMap, roster), [workingMap, roster]);

  const handleSave = async () => {
    if (!draft) {
      toast.info("No changes to save.");
      return;
    }

    const payload = Object.entries(draft)
      .filter(([key, score]) => gradeMap[key] !== score)
      .map(([key, score]) => {
        const [studentId, assignment] = key.split(/:(.+)/);
        const column = GRADEBOOK_COLUMNS.find((c) => c.id === assignment);
        return { studentId, subject: GRADEBOOK_SUBJECT, assignment, score, maxScore: column?.maxScore ?? 100 };
      });

    if (!payload.length) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest<{ message: string }>("/grades", {
        method: "POST",
        body: JSON.stringify({ grades: payload }),
      });
      await queryClient.invalidateQueries({ queryKey: GRADEBOOK_QUERY_KEY });
      setDraft(null);
      toast.success("Gradebook saved", {
        description: `${payload.length} ${payload.length === 1 ? "entry" : "entries"} synced to the backend.`,
      });
    } catch {
      toast.error("Could not save the gradebook. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Student view: personal grade card ----------
  if (role === "student") {
    const me = roster.find((student) => String(student.id) === String(user?.id));

    return (
      <>
        <PageHeader
          eyebrow="Your performance"
          title="My grades"
          description="Your scores across every assignment this term."
        />
        <Card className="overflow-hidden border-border/60 shadow-soft">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
                  {me?.avatar ?? user?.name?.slice(0, 2).toUpperCase() ?? "ST"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{user?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Overall: {me ? (studentAverages[me.id] ?? 0) : 0}%
                </p>
              </div>
            </div>
            <Badge className="bg-success/15 text-success hover:bg-success/15">On track</Badge>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading grades...
            </div>
          ) : !me ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No grade record found for your account yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {GRADEBOOK_COLUMNS.map((column) => {
                const key = gradeKey(me.id, column.id);
                const hasScore = key in workingMap;
                const score = workingMap[key] ?? 0;
                const pct = Math.round((score / column.maxScore) * 100);
                return (
                  <li key={column.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <p className="font-semibold text-foreground">{column.title}</p>
                      <p className="text-xs text-muted-foreground">Out of {column.maxScore}</p>
                    </div>
                    <div className="text-right">
                      {hasScore ? (
                        <>
                          <p className="font-display text-lg font-bold">
                            {score}
                            <span className="text-sm text-muted-foreground">/{column.maxScore}</span>
                          </p>
                          <p
                            className={`text-xs font-semibold ${
                              pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"
                            }`}
                          >
                            {pct}%
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not graded yet</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </>
    );
  }

  // ---------- Teacher view: editable matrix ----------
  return (
    <>
      <PageHeader
        eyebrow={`Section - ${GRADEBOOK_SUBJECT}`}
        title="Gradebook"
        description="Click any cell to update a student's score. Averages recalculate live and Save writes to the backend."
        actions={
          <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground hover:opacity-95" disabled={isSaving || !draft}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        }
      />

      <Card className="overflow-hidden border-border/60 shadow-soft">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading roster and grades...
          </div>
        ) : roster.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No students found. Students will appear here once they sign up.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-secondary/95 px-4 py-3 backdrop-blur sm:px-6">Student</th>
                  {GRADEBOOK_COLUMNS.map((column) => (
                    <th key={column.id} className="px-3 py-3 text-center">
                      <div className="font-semibold text-foreground">{column.title}</div>
                      <div className="font-normal normal-case tracking-normal text-muted-foreground">/ {column.maxScore}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Avg.</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => {
                  const avg = studentAverages[student.id] ?? 0;
                  return (
                    <tr key={student.id} className="border-b border-border last:border-0 transition-base hover:bg-secondary/30">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{student.avatar}</AvatarFallback>
                          </Avatar>
                          <span className="whitespace-nowrap font-medium text-foreground">{student.name}</span>
                        </div>
                      </td>
                      {GRADEBOOK_COLUMNS.map((column) => {
                        const key = gradeKey(student.id, column.id);
                        const score = workingMap[key] ?? "";
                        return (
                          <td key={column.id} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={column.maxScore}
                              value={score}
                              placeholder="-"
                              onChange={(e) => setScore(student.id, column.id, e.target.value)}
                              className="h-9 w-16 rounded-md border border-transparent bg-secondary/40 px-2 text-center text-sm font-semibold text-foreground transition-base hover:border-border focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/30"
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={`font-mono ${
                            avg >= 70
                              ? "bg-success/15 text-success hover:bg-success/15"
                              : avg >= 50
                              ? "bg-warning/15 text-warning hover:bg-warning/15"
                              : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                          }`}
                        >
                          {avg}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
