import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, X, Clock, Save, Filter, Trash2, QrCode, ScanLine, TimerReset } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { students as mockStudents } from "@/data/mockData";
import { useRole } from "@/context/RoleContext";
import { apiRequest } from "@/lib/api";
import { useAttendanceSummary } from "@/hooks/useAttendanceSummary";

type Status = "present" | "absent" | "late" | null;

interface RosterStudent {
  id: string;
  name: string;
  avatar: string;
  section: string;
  email?: string;
  studentId?: string;
}

interface ApiStudent {
  id: number | string;
  name: string;
  email?: string;
  studentId?: string;
  major?: string;
  year?: string;
}

interface ApiAttendanceRecord {
  studentId: number | string;
  status: Exclude<Status, null>;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const mockRoster: RosterStudent[] = mockStudents.map((student) => ({
  id: student.id,
  name: student.name,
  avatar: student.avatar,
  section: student.section,
}));

const formatStudent = (student: ApiStudent): RosterStudent => ({
  id: String(student.id),
  name: student.name,
  email: student.email,
  studentId: student.studentId,
  avatar: initials(student.name),
  section: student.year || student.major || "Student",
});

export default function Attendance() {
  const { role } = useRole();
  const { data: mySummary } = useAttendanceSummary();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [roster, setRoster] = useState<RosterStudent[]>(mockRoster);
  const [records, setRecords] = useState<Record<string, Status>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<RosterStudent | null>(null);
  const [qrSession, setQrSession] = useState<{ code: string; windowMinutes: number; expiresAt: string } | null>(null);
  const [scanCode, setScanCode] = useState("");

  useEffect(() => {
    if (role !== "teacher") return;

    let active = true;

    Promise.all([
      apiRequest<ApiStudent[]>("/attendance/students"),
      apiRequest<ApiAttendanceRecord[]>(`/attendance?date=${date}`),
    ])
      .then(([students, attendance]) => {
        if (!active) return;

        const nextRoster = students.map(formatStudent);
        const nextRecords: Record<string, Status> = {};
        nextRoster.forEach((student) => {
          nextRecords[student.id] = null;
        });
        attendance.forEach((record) => {
          nextRecords[String(record.studentId)] = record.status;
        });

        setRoster(nextRoster);
        setRecords(nextRecords);
      })
      .catch(() => {
        if (!active) return;

        const seeded: Record<string, Status> = {};
        mockRoster.forEach((student, i) => {
          seeded[student.id] = i % 7 === 0 ? "absent" : i % 9 === 0 ? "late" : "present";
        });
        setRoster(mockRoster);
        setRecords(seeded);
        toast.error("Could not load backend roster. Showing sample students.");
      });

    return () => {
      active = false;
    };
  }, [date, role]);

  const setStatus = (id: string, status: Status) =>
    setRecords((prev) => ({ ...prev, [id]: status }));

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, unmarked: 0 };
    roster.forEach((student) => {
      const v = records[student.id];
      if (v === "present") c.present++;
      else if (v === "absent") c.absent++;
      else if (v === "late") c.late++;
      else c.unmarked++;
    });
    return c;
  }, [records, roster]);

  const markAll = (status: Status) => {
    const next: Record<string, Status> = {};
    roster.forEach((student) => (next[student.id] = status));
    setRecords(next);
  };

  const generateQrSession = () => {
    apiRequest<{ code: string; windowMinutes: number; expiresAt: string }>("/academic/attendance-sessions", {
      method: "POST",
      body: JSON.stringify({ windowMinutes: 10 }),
    })
      .then((session) => {
        setQrSession({
          code: session.code,
          windowMinutes: session.windowMinutes,
          expiresAt: new Date(session.expiresAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
        toast.success("QR attendance code generated", {
          description: "Students can use this code during the 10 minute window.",
        });
      })
      .catch(() => {
        toast.error("Could not generate QR attendance code");
      });
  };

  const handleScanAttendance = () => {
    if (!scanCode.trim()) {
      toast.error("Enter the QR attendance code first.");
      return;
    }

    apiRequest<{ message: string }>("/academic/attendance-sessions/check-in", {
      method: "POST",
      body: JSON.stringify({ code: scanCode.trim() }),
    })
      .then(() => {
        toast.success("Attendance recorded", {
          description: "Your attendance was marked for today's class.",
        });
        setScanCode("");
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not record attendance");
      });
  };

  const handleSave = async () => {
    const payload = Object.entries(records)
      .filter(([, status]) => status)
      .map(([studentId, status]) => ({ studentId, status }));

    setIsSaving(true);
    try {
      await apiRequest<{ message: string }>("/attendance", {
        method: "POST",
        body: JSON.stringify({ date, records: payload }),
      });
      toast.success("Attendance saved", {
        description: `${payload.length} students marked for ${date}.`,
      });
    } catch {
      toast.error("Could not save attendance");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;

    setIsRemoving(true);
    try {
      await apiRequest<{ message: string }>(`/students/${studentToRemove.id}`, {
        method: "DELETE",
      });
      setRoster((current) => current.filter((student) => student.id !== studentToRemove.id));
      setRecords((current) => {
        const next = { ...current };
        delete next[studentToRemove.id];
        return next;
      });
      toast.success(`${studentToRemove.name} removed`);
      setStudentToRemove(null);
    } catch {
      toast.error("Could not remove student");
    } finally {
      setIsRemoving(false);
    }
  };

  if (role === "student") {
    return (
      <>
        <PageHeader
          eyebrow="Your record"
          title="My attendance"
          description="Track your presence across all subjects this semester."
        />
        <Card className="mb-6 border-border/60 p-5 shadow-soft sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ScanLine className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Scan QR attendance</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Use the code shown by your teacher during the active attendance window.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Input
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                placeholder="RUPPER-20260710-1234"
                className="h-10 sm:w-64"
              />
              <Button className="bg-gradient-primary text-primary-foreground" onClick={handleScanAttendance}>
                <Check className="mr-2 h-4 w-4" />
                Mark present
              </Button>
            </div>
          </div>
        </Card>
        <Card className="border-border/60 p-6 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile label="Present" value={`${mySummary?.present ?? 0} days`} tone="success" />
            <SummaryTile label="Absent" value={`${mySummary?.absent ?? 0} days`} tone="destructive" />
            <SummaryTile label="Late" value={`${mySummary?.late ?? 0} days`} tone="warning" />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {mySummary?.total ? `${mySummary.percentage}% attendance across ${mySummary.total} recorded days.` : "No attendance has been recorded for you yet."}
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Section roster"
        title="Take attendance"
        description="Keep today's roster and attendance status accurate for your class."
        actions={
          <>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-44 bg-background pl-9 text-foreground [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground hover:opacity-95" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Present" value={counts.present} tone="success" />
        <SummaryTile label="Absent" value={counts.absent} tone="destructive" />
        <SummaryTile label="Late" value={counts.late} tone="warning" />
        <SummaryTile label="Unmarked" value={counts.unmarked} tone="muted" />
      </div>

      <Card className="mb-6 border-border/60 p-5 shadow-soft sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">QR attendance session</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Generate a temporary attendance code for the current class. Students can scan or enter the code before the window closes.
              </p>
              {qrSession && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-success">
                    <TimerReset className="h-3.5 w-3.5" />
                    {qrSession.windowMinutes} min window
                  </span>
                  <span>Expires at {qrSession.expiresAt}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-center">
            <div className="mx-auto grid h-32 w-32 grid-cols-4 gap-1 rounded-xl bg-background p-3 shadow-soft">
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={index}
                  className={`rounded-sm ${qrSession && (index + qrSession.code.length) % 3 !== 0 ? "bg-foreground" : "bg-muted"}`}
                />
              ))}
            </div>
            <p className="mt-3 font-mono text-sm font-semibold text-foreground">{qrSession?.code || "No active code"}</p>
            <Button className="mt-4 w-full bg-gradient-primary text-primary-foreground" onClick={generateQrSession}>
              <QrCode className="mr-2 h-4 w-4" />
              Generate QR code
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Bulk mark
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => markAll("present")}>All present</Button>
            <Button size="sm" variant="outline" onClick={() => markAll("absent")}>All absent</Button>
            <Button size="sm" variant="ghost" onClick={() => markAll(null)}>Clear</Button>
          </div>
        </div>

        <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
          <span>Student</span>
          <span>Status</span>
          <span>Manage</span>
        </div>

        <ul className="divide-y divide-border">
          {roster.length === 0 && (
            <li className="px-6 py-8 text-sm text-muted-foreground">No students in this roster.</li>
          )}

          {roster.map((student) => {
            const status = records[student.id];
            return (
              <li
                key={student.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setStudentToRemove(student);
                }}
                className="flex flex-col gap-3 px-4 py-3 transition-base hover:bg-secondary/40 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {student.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID - {student.studentId || student.id} - {student.section}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusButton
                    active={status === "present"}
                    onClick={() => setStatus(student.id, "present")}
                    icon={<Check className="h-4 w-4" />}
                    label="Present"
                    tone="success"
                  />
                  <StatusButton
                    active={status === "late"}
                    onClick={() => setStatus(student.id, "late")}
                    icon={<Clock className="h-4 w-4" />}
                    label="Late"
                    tone="warning"
                  />
                  <StatusButton
                    active={status === "absent"}
                    onClick={() => setStatus(student.id, "absent")}
                    icon={<X className="h-4 w-4" />}
                    label="Absent"
                    tone="destructive"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setStudentToRemove(student)}
                  aria-label={`Remove ${student.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      <AlertDialog open={Boolean(studentToRemove)} onOpenChange={(open) => !open && setStudentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove student?</AlertDialogTitle>
            <AlertDialogDescription>
              {studentToRemove
                ? `${studentToRemove.name} will be removed from the system. Their attendance and grade records will also be deleted.`
                : "This student will be removed from the system."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveStudent}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "success" | "destructive" | "warning" | "muted";
}) {
  const styles = {
    success: "bg-success/10 text-success border-success/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/15 text-warning border-warning/20",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 ${styles}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusButton({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "success" | "warning" | "destructive";
}) {
  const activeStyles = {
    success: "bg-success text-success-foreground border-success shadow-soft",
    warning: "bg-warning text-warning-foreground border-warning shadow-soft",
    destructive: "bg-destructive text-destructive-foreground border-destructive shadow-soft",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-base ${
        active
          ? activeStyles
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
