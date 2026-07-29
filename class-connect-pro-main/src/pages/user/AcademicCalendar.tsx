import { useState } from "react";
import { CalendarDays, CalendarRange, Clock, GraduationCap, PartyPopper, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyncStatus } from "@/components/shared/SyncStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/context/RoleContext";
import { ACADEMIC_CALENDAR_QUERY_KEY, useAcademicCalendar, useAcademicCourses } from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";

const typeIcon = {
  exam: GraduationCap,
  assignment: Clock,
  holiday: PartyPopper,
  event: CalendarRange,
};

const typeTone = {
  exam: "bg-destructive/10 text-destructive border-destructive/20",
  assignment: "bg-warning/15 text-warning border-warning/20",
  holiday: "bg-success/10 text-success border-success/20",
  event: "bg-primary/10 text-primary border-primary/20",
};

const NO_COURSE = "none";

const emptyEventForm = { title: "", date: "", type: "event", priority: "normal", courseId: NO_COURSE };

export default function AcademicCalendar() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: events = [], isFetching } = useAcademicCalendar();
  const { data: courses = [] } = useAcademicCourses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [isCreating, setIsCreating] = useState(false);
  const counts = events.reduce<Record<string, number>>((total, event) => {
    total[event.type] = (total[event.type] || 0) + 1;
    return total;
  }, {});

  const openDialog = () => {
    setEventForm(emptyEventForm);
    setDialogOpen(true);
  };

  const createEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) {
      toast.error("Title and date are required.");
      return;
    }

    setIsCreating(true);
    try {
      await apiRequest<{ message: string }>("/academic/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: eventForm.title.trim(),
          date: eventForm.date,
          type: eventForm.type,
          priority: eventForm.priority,
          courseId: eventForm.courseId === NO_COURSE ? undefined : eventForm.courseId,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_CALENDAR_QUERY_KEY });
      toast.success("Calendar event created");
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create calendar event");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="University calendar"
        title="Academic calendar"
        description="Track exams, assignments, holidays, university events, and important academic dates."
        actions={
          role === "teacher" ? (
            <Button size="sm" variant="secondary" className="font-semibold" onClick={openDialog}>
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
            return (
              <div key={event.id} className="flex flex-col gap-4 p-5 transition-base hover:bg-secondary/30 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${typeTone[event.type]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{event.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.course ? `${event.course} - ` : ""}
                      {event.date}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={`border ${typeTone[event.type]}`}>{event.type}</Badge>
                  <Badge variant="outline">{event.priority}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add calendar event</DialogTitle>
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
            <Button onClick={createEvent} className="bg-gradient-primary text-primary-foreground" disabled={isCreating}>
              {isCreating ? "Creating..." : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
