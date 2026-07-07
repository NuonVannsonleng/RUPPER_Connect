import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { students, assignments } from "@/data/mockData";
import { useRole } from "@/context/RoleContext";
import {
  GRADEBOOK_QUERY_KEY,
  GradeMap,
  buildInitialGradeMap,
  calculateStudentAverages,
  useGradebook,
} from "@/hooks/useGradebook";

export default function Gradebook() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: gradeMap = buildInitialGradeMap() } = useGradebook();

  const setScore = (studentId: string, assignmentId: string, raw: string) => {
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    queryClient.setQueryData<GradeMap>(GRADEBOOK_QUERY_KEY, (current) => ({
      ...buildInitialGradeMap(),
      ...(current ?? {}),
      [`${studentId}:${assignmentId}`]: num,
    }));
  };

  const studentAverages = useMemo(() => calculateStudentAverages(gradeMap), [gradeMap]);

  const handleSave = () => {
    // TODO: POST /api/grades { gradeMap }
    console.log("Saving grades ->", gradeMap);
    toast.success("Gradebook saved", {
      description: `${Object.keys(gradeMap).length} entries synced.`,
    });
  };

  // ---------- Student view: personal grade card ----------
  if (role === "student") {
    const me = students[0]; // placeholder - would be auth user
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
                  {me.avatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{me.name}</p>
                <p className="text-xs text-muted-foreground">Overall: {studentAverages[me.id]}%</p>
              </div>
            </div>
            <Badge className="bg-success/15 text-success hover:bg-success/15">On track</Badge>
          </div>
          <ul className="divide-y divide-border">
            {assignments.map((a) => {
              const score = gradeMap[`${me.id}:${a.id}`] ?? 0;
              const pct = Math.round((score / a.maxScore) * 100);
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div>
                    <p className="font-semibold text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground">Out of {a.maxScore}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-bold">{score}<span className="text-sm text-muted-foreground">/{a.maxScore}</span></p>
                    <p className={`text-xs font-semibold ${pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>{pct}%</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </>
    );
  }

  // ---------- Teacher view: editable matrix ----------
  return (
    <>
      <PageHeader
        eyebrow="Section 11-A - Algebra II"
        title="Gradebook"
        description="Click any cell to update a student's score. Averages recalculate live."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Assignment
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground hover:opacity-95">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 z-10 bg-secondary/95 px-4 py-3 backdrop-blur sm:px-6">Student</th>
                {assignments.map((a) => (
                  <th key={a.id} className="px-3 py-3 text-center">
                    <div className="font-semibold text-foreground">{a.title}</div>
                    <div className="font-normal normal-case tracking-normal text-muted-foreground">/ {a.maxScore}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center">Avg.</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const avg = studentAverages[s.id];
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 transition-base hover:bg-secondary/30">
                    <td className="sticky left-0 z-10 bg-card px-4 py-3 sm:px-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{s.avatar}</AvatarFallback>
                        </Avatar>
                        <span className="whitespace-nowrap font-medium text-foreground">{s.name}</span>
                      </div>
                    </td>
                    {assignments.map((a) => {
                      const key = `${s.id}:${a.id}`;
                      const score = gradeMap[key] ?? 0;
                      return (
                        <td key={a.id} className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={a.maxScore}
                            value={score}
                            onChange={(e) => setScore(s.id, a.id, e.target.value)}
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
      </Card>
    </>
  );
}
