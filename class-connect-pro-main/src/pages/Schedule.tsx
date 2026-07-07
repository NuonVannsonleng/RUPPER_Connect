import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin, User, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useRole } from "@/context/RoleContext";
import { apiRequest } from "@/lib/api";
import {
  ApiSchedule,
  ClassSession,
  DAYS,
  SCHEDULE_QUERY_KEY,
  formatSchedule,
  useSchedule,
} from "@/hooks/useSchedule";
import { toast } from "sonner";

const subjectTone = (subject: string) => {
  const tones = [
    "border-l-primary bg-primary/5",
    "border-l-info bg-info/5",
    "border-l-success bg-success/5",
    "border-l-accent bg-accent/10",
    "border-l-warning bg-warning/10",
    "border-l-destructive bg-destructive/5",
  ];
  let h = 0;
  for (const c of subject) h = (h + c.charCodeAt(0)) % tones.length;
  return tones[h];
};

export default function Schedule() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: sessions = [], isError } = useSchedule();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ClassSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("Monday");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [roleVisibility, setRoleVisibility] = useState<"student" | "teacher" | "both">("both");

  useEffect(() => {
    if (isError) toast.error("Could not load backend schedule. Showing sample timetable.");
  }, [isError]);

  const visibleSessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.roleVisibility === "both" || session.roleVisibility === role
      ),
    [role, sessions]
  );

  const grouped = useMemo(() => {
    const map: Record<string, ClassSession[]> = {};
    DAYS.forEach((day) => (map[day] = []));
    visibleSessions.forEach((session) => {
      if (map[session.day]) map[session.day].push(session);
    });
    Object.values(map).forEach((items) =>
      items.sort((a, b) => a.startTime.localeCompare(b.startTime))
    );
    return map;
  }, [visibleSessions]);

  const resetForm = () => {
    setEditing(null);
    setSubject("");
    setTeacher("");
    setRoom("");
    setDayOfWeek("Monday");
    setStartTime("08:00");
    setEndTime("09:30");
    setRoleVisibility("both");
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (session: ClassSession) => {
    setEditing(session);
    setSubject(session.subject);
    setTeacher(session.teacher === "Teacher TBA" ? "" : session.teacher);
    setRoom(session.room === "Room TBA" ? "" : session.room);
    setDayOfWeek(session.day);
    setStartTime(session.startTime);
    setEndTime(session.endTime);
    setRoleVisibility(session.roleVisibility);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!subject.trim() || !dayOfWeek || !startTime || !endTime) {
      toast.error("Please fill in the class name, day, start time, and end time.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: subject.trim(),
        teacher: teacher.trim(),
        room: room.trim(),
        dayOfWeek,
        startTime,
        endTime,
        roleVisibility,
      };
      const saved = editing
        ? await apiRequest<ApiSchedule>(`/schedules/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiRequest<ApiSchedule>("/schedules", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const formatted = formatSchedule(saved);
      const nextSessions = editing
        ? sessions.map((session) => (session.id === formatted.id ? formatted : session))
        : [...sessions, formatted];

      queryClient.setQueryData<ClassSession[]>(SCHEDULE_QUERY_KEY, nextSessions);
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEY });
      setOpen(false);
      resetForm();
      toast.success(editing ? "Class updated" : "Class added");
    } catch {
      toast.error(editing ? "Could not update class" : "Could not add class");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;

    setIsDeleting(true);
    try {
      await apiRequest<{ message: string }>(`/schedules/${sessionToDelete.id}`, {
        method: "DELETE",
      });
      const nextSessions = sessions.filter((session) => session.id !== sessionToDelete.id);

      queryClient.setQueryData<ClassSession[]>(SCHEDULE_QUERY_KEY, nextSessions);
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEY });
      toast.success("Class deleted");
      setSessionToDelete(null);
    } catch {
      toast.error("Could not delete class");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Weekly view"
        title="Class schedule"
        description={
          role === "teacher"
            ? "Manage your timetable, rooms, and class visibility from one place."
            : "Your weekly classes - never miss a session."
        }
        actions={
          role === "teacher" ? (
            <Button onClick={openCreate} className="bg-gradient-primary text-primary-foreground hover:opacity-95">
              <Plus className="mr-1.5 h-4 w-4" />
              New class
            </Button>
          ) : undefined
        }
      />

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit class" : "Add class"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="class-subject">Class name</Label>
              <Input id="class-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Computer Science" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-teacher">Teacher</Label>
              <Input id="class-teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Ms. Chen" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-room">Room</Label>
              <Input id="class-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Lab-1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-day">Day</Label>
              <select
                id="class-day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-visibility">Visibility</Label>
              <select
                id="class-visibility"
                value={roleVisibility}
                onChange={(e) => setRoleVisibility(e.target.value as "student" | "teacher" | "both")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="both">Students and teachers</option>
                <option value="student">Students only</option>
                <option value="teacher">Teachers only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-start">Start</Label>
              <Input id="class-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-end">End</Label>
              <Input id="class-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground hover:opacity-95" disabled={isSaving}>
              {isSaving ? "Saving..." : editing ? "Save changes" : "Add class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {DAYS.map((day) => {
          const isToday = day === today;
          const items = grouped[day];
          return (
            <Card
              key={day}
              className={`flex flex-col p-4 shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant ${
                isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border/60"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-foreground">{day}</h3>
                {isToday && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    Today
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground">
                    No classes
                  </div>
                )}
                {items.map((session) => (
                  <div
                    key={session.id}
                    className={`group rounded-lg border-l-4 p-3 transition-base hover:translate-x-0.5 hover:bg-card/80 ${subjectTone(session.subject)}`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {session.time}
                      </p>
                      {role === "teacher" && (
                        <div className="flex shrink-0 gap-1 opacity-100 xl:opacity-0 xl:transition-base xl:group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => openEdit(session)}
                            aria-label={`Edit ${session.subject}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setSessionToDelete(session)}
                            aria-label={`Delete ${session.subject}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="font-semibold text-foreground">{session.subject}</p>
                    <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {session.room}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {session.teacher}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={Boolean(sessionToDelete)} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>
              This class will be removed from the weekly schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
