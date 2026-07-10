import { CalendarDays, CalendarRange, Clock, GraduationCap, PartyPopper, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRole } from "@/context/RoleContext";
import { ACADEMIC_CALENDAR_QUERY_KEY, useAcademicCalendar } from "@/hooks/useAcademicPlatform";
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

export default function AcademicCalendar() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: events = [], isFetching } = useAcademicCalendar();
  const counts = events.reduce<Record<string, number>>((total, event) => {
    total[event.type] = (total[event.type] || 0) + 1;
    return total;
  }, {});

  const createEvent = async () => {
    try {
      await apiRequest<{ message: string }>("/academic/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: "New university event",
          date: "2026-08-05",
          type: "event",
          priority: "normal",
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ACADEMIC_CALENDAR_QUERY_KEY });
      toast.success("Calendar event created in backend");
    } catch {
      toast.error("Could not create calendar event");
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
            <Button size="sm" variant="secondary" className="font-semibold" onClick={createEvent}>
              <Plus className="mr-2 h-4 w-4" />
              Add event
            </Button>
          ) : undefined
        }
      />

      {isFetching && (
        <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Syncing calendar with backend...
        </div>
      )}

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
    </>
  );
}
