import { useState } from "react";
import { CalendarDays, CalendarRange, Clock, GraduationCap, Pencil, PartyPopper, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyncStatus } from "@/components/shared/SyncStatus";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/context/RoleContext";
import type { AcademicCalendarEvent } from "@/data/academicPlatform";
import { ACADEMIC_CALENDAR_QUERY_KEY, useAcademicCalendar, useAcademicCourses } from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";
import { formatLongDate, todayIso as currentIso, type MonthCursor } from "@/lib/calendarMonth";

/** Plain YYYY-MM-DD for today in the viewer's local time zone - event dates are stored and
 *  returned the same way, so this stays a safe string comparison with no timezone reinterpretation. */
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const isPastEvent = (event: AcademicCalendarEvent) => event.date < todayIso();

const typeIcon = {
  exam: GraduationCap,
  assignment: Clock,
  holiday: PartyPopper,
  event: CalendarRange,
};

// `event` uses info rather than primary: this theme's primary is hsl(0 78% 50%) and
// destructive is hsl(0 75% 55%), the same red, so an event and an exam were indistinguishable
// at a glance - which matters most in the month grid, where colour is all you get.
const typeTone = {
  exam: "bg-destructive/10 text-destructive border-destructive/20",
  assignment: "bg-warning/15 text-warning border-warning/20",
  holiday: "bg-success/10 text-success border-success/20",
  event: "bg-info/10 text-info border-info/20",
};

const NO_COURSE = "none";

const emptyEventForm = { title: "", date: "", type: "event", priority: "normal", courseId: NO_COURSE };

export default function AcademicCalendar() {
  const { canTeach } = useRole();
  const queryClient = useQueryClient();
  const { data: events = [], isFetching } = useAcademicCalendar();
  const { data: courses = [] } = useAcademicCourses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<AcademicCalendarEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // The grid opens on the current month, and on today, so the first thing anyone sees is
  // where they actually are in the year.
  const [cursor, setCursor] = useState<MonthCursor>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedIso, setSelectedIso] = useState<string>(() => currentIso());
  const counts = events.reduce<Record<string, number>>((total, event) => {
    total[event.type] = (total[event.type] || 0) + 1;
    return total;
  }, {});

  const selectedDayEvents = events.filter((event) => event.date === selectedIso);

  const openDialog = (date?: string) => {
    setEditingEvent(null);
    setEventForm({ ...emptyEventForm, date: date ?? "" });
    setDialogOpen(true);
  };

  const openEditDialog = (event: AcademicCalendarEvent) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      date: event.date,
      type: event.type,
      priority: event.priority,
      courseId: event.courseId || NO_COURSE,
    });
    setDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) {
      toast.error("Title and date are required.");
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        title: eventForm.title.trim(),
        date: eventForm.date,
        type: eventForm.type,
        priority: eventForm.priority,
        courseId: eventForm.courseId === NO_COURSE ? undefined : eventForm.courseId,
      };

      if (editingEvent) {
        await apiRequest<{ message: string }>(`/academic/calendar/${editingEvent.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<{ message: string }>("/academic/calendar", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_CALENDAR_QUERY_KEY });
      toast.success(editingEvent ? "Calendar event updated" : "Calendar event created");
      setDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : editingEvent ? "Could not update calendar event" : "Could not create calendar event"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const deleteEvent = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    try {
      await apiRequest<{ message: string }>(`/academic/calendar/${eventToDelete.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_CALENDAR_QUERY_KEY });
      toast.success("Calendar event deleted");
      setEventToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete calendar event");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="University calendar"
        title="Academic calendar"
        description="Track exams, assignments, holidays, university events, and important academic dates."
        actions={
          canTeach ? (
            <Button size="sm" variant="secondary" className="font-semibold" onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add event
            </Button>
          ) : undefined
        }
      />

      {isFetching && <SyncStatus label="the calendar" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["exam", "assignment", "holiday", "event"] as const).map((type) => {
          const Icon = typeIcon[type];
          return (
            <Card key={type} className="border-border/60 p-5 shadow-soft">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${typeTone[type]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{type}</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground">{counts[type] || 0}</p>
            </Card>
          );
        })}
      </div>

      <Card className="mb-6 overflow-hidden border-border/60 shadow-soft">
        <MonthCalendar
          events={events}
          cursor={cursor}
          onCursorChange={setCursor}
          selectedIso={selectedIso}
          onSelectDay={setSelectedIso}
        />

        {/* What is on the day you tapped. The grid can only fit two chips per cell, so this
            is where a busy day is actually read - and where a teacher adds to it. */}
        <div className="border-t border-border bg-secondary/20 px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-foreground">{formatLongDate(selectedIso)}</h2>
            {canTeach && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openDialog(selectedIso)}>
                <Plus className="h-3.5 w-3.5" />
                Add on this day
              </Button>
            )}
          </div>

          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled for this day.</p>
          ) : (
            <div className="grid gap-2">
              {selectedDayEvents.map((event) => {
                const Icon = typeIcon[event.type];
                return (
                  <div
                    key={event.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${typeTone[event.type]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{event.title}</span>
                      {event.course && <span className="block text-xs text-muted-foreground">{event.course}</span>}
                    </span>
                    <Badge className={`border ${typeTone[event.type]}`}>{event.type}</Badge>
                    <Badge variant="outline">{event.priority}</Badge>
                    {canTeach && (
                      <span className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => openEditDialog(event)}
                          aria-label={`Edit ${event.title}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setEventToDelete(event)}
                          aria-label={`Delete ${event.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="border-b border-border bg-secondary/40 px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" />
            Upcoming academic events
          </div>
        </div>
        {events.length === 0 && !isFetching && (
          <div className="p-5">
            <EmptyState icon={CalendarDays} title="No events scheduled" detail="Exams, deadlines, and university events will appear here." />
          </div>
        )}
        <div className="divide-y divide-border">
          {events.map((event) => {
            const Icon = typeIcon[event.type];
            const past = isPastEvent(event);
            return (
              <div
                key={event.id}
                className={`flex flex-col gap-4 p-5 transition-base hover:bg-secondary/30 sm:flex-row sm:items-center sm:justify-between ${
                  past ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${typeTone[event.type]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{event.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.course ? `${event.course} - ` : ""}
                      {event.date}
                      {event.createdByName ? ` - added by ${event.createdByName}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {past && (
                    <Badge variant="outline" className="border-border bg-secondary text-secondary-foreground">
                      Past
                    </Badge>
                  )}
                  <Badge className={`border ${typeTone[event.type]}`}>{event.type}</Badge>
                  <Badge variant="outline">{event.priority}</Badge>
                  {canTeach && (
                    <div className="ml-1 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => openEditDialog(event)}
                        aria-label={`Edit ${event.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setEventToDelete(event)}
                        aria-label={`Delete ${event.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit calendar event" : "Add calendar event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={eventForm.title}
                onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Midterm review session"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={eventForm.type} onValueChange={(value) => setEventForm((f) => ({ ...f, type: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Priority</Label>
                <Select value={eventForm.priority} onValueChange={(value) => setEventForm((f) => ({ ...f, priority: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Course (optional)</Label>
                <Select value={eventForm.courseId} onValueChange={(value) => setEventForm((f) => ({ ...f, courseId: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COURSE}>None</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={saveEvent} className="bg-gradient-primary text-primary-foreground" disabled={isCreating}>
              {isCreating ? (editingEvent ? "Saving..." : "Creating...") : editingEvent ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(eventToDelete)} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete calendar event?</AlertDialogTitle>
            <AlertDialogDescription>
              {eventToDelete ? `"${eventToDelete.title}" will be removed for everyone. This cannot be undone.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteEvent}
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
