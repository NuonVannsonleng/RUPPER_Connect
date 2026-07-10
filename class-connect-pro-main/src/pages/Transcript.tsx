import { Download, GraduationCap, Printer, ScrollText, Star } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { studentAcademicProfile } from "@/data/academicPlatform";
import { useAcademicTranscript } from "@/hooks/useAcademicPlatform";

export default function Transcript() {
  const { data: transcriptRecords = [], isFetching } = useAcademicTranscript();
  const credits = transcriptRecords.reduce((total, record) => total + record.credits, 0);
  const weightedGpa = credits
    ? transcriptRecords.reduce((total, record) => total + record.gradePoint * record.credits, 0) / credits
    : 0;

  const exportPdf = () => {
    toast.success("Preparing transcript PDF view.");
    window.setTimeout(() => window.print(), 120);
  };

  return (
    <>
      <PageHeader
        eyebrow="Academic record"
        title="Transcript and GPA"
        description="Review course history, credits, semester grades, and overall GPA."
        actions={
          <Button size="sm" variant="secondary" className="font-semibold" onClick={exportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall GPA" value={studentAcademicProfile.gpa.toFixed(2)} hint="Current record" icon={Star} tone="primary" />
        <StatCard label="Calculated GPA" value={weightedGpa.toFixed(2)} hint="From transcript" icon={GraduationCap} tone="success" />
        <StatCard label="Completed credits" value={credits} hint="Recorded courses" icon={ScrollText} tone="info" />
        <StatCard label="Export" value="PDF" hint="Printable transcript" icon={Printer} tone="warning" />
      </div>

      {isFetching && (
        <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Syncing transcript with backend...
        </div>
      )}

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="border-b border-border bg-secondary/40 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">{studentAcademicProfile.name}</h2>
          <p className="text-sm text-muted-foreground">
            {studentAcademicProfile.studentId} - {studentAcademicProfile.major}
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semester</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transcriptRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.semester}</TableCell>
                <TableCell>
                  <span className="font-semibold text-foreground">{record.courseCode}</span>
                  <span className="block text-xs text-muted-foreground">{record.courseTitle}</span>
                </TableCell>
                <TableCell>{record.credits}</TableCell>
                <TableCell>{record.gradeLetter}</TableCell>
                <TableCell>{record.gradePoint.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
