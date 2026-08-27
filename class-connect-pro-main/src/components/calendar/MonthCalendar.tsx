import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AcademicCalendarEvent } from "@/data/academicPlatform";
import {
  addMonths,
  buildMonthGrid,
  canGoBack,
  canGoForward,
  formatLongDate,
  groupByDate,
  MONTH_NAMES,
  selectableYears,
  todayIso,
  WEEKDAY_NAMES,
  type MonthCursor,
} from "@/lib/calendarMonth";

/** Solid fills for the chips, so a day's events read at a glance without the legend. */
const TYPE_CHIP: Record<AcademicCalendarEvent["type"], string> = {
  exam: "bg-destructive/15 text-destructive",
  assignment: "bg-warning/20 text-warning",
  holiday: "bg-success/15 text-success",
  event: "bg-info/15 text-info",
};

/** The mobile grid is too tight for chips, so a day's types collapse to dots. */
const TYPE_DOT: Record<AcademicCalendarEvent["type"], string> = {
  exam: "bg-destructive",
  assignment: "bg-warning",
  holiday: "bg-success",
  event: "bg-info",
};

const MAX_CHIPS = 2;

interface MonthCalendarProps {
  events: AcademicCalendarEvent[];
  cursor: MonthCursor;
  onCursorChange: (cursor: MonthCursor) => void;
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
}

export function MonthCalendar({ events, cursor, onCursorChange, selectedIso, onSelectDay }: MonthCalendarProps) {
  const cells = buildMonthGrid(cursor);
  const byDate = groupByDate(events);
  const today = todayIso();

  const goToToday = () => {
    const now = new Date();
    onCursorChange({ year: now.getFullYear(), month: now.getMonth() });
    onSelectDay(today);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onCursorChange(addMonths(cursor, -1))}
            disabled={!canGoBack(cursor)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onCursorChange(addMonths(cursor, 1))}
            disabled={!canGoForward(cursor)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Select
            value={String(cursor.month)}
            onValueChange={(value) => onCursorChange({ ...cursor, month: Number(value) })}
          >
            <SelectTrigger className="h-9 w-[8.5rem]" aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(cursor.year)}
            onValueChange={(value) => onCursorChange({ ...cursor, year: Number(value) })}
          >
            <SelectTrigger className="h-9 w-[5.5rem]" aria-label="Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectableYears().map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" className="h-9 gap-2" onClick={goToToday}>
          <CalendarCheck className="h-4 w-4" />
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-secondary/20">
        {WEEKDAY_NAMES.map((day) => (
          <div
            key={day}
            className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayEvents = byDate.get(cell.iso) ?? [];
          const isToday = cell.iso === today;
          const isSelected = cell.iso === selectedIso;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDay(cell.iso)}
              aria-label={`${formatLongDate(cell.iso)}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ", no events"}`}
              aria-pressed={isSelected}
              className={`flex min-h-[4.25rem] flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-base [&:nth-child(7n)]:border-r-0 hover:bg-secondary/50 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[6rem] sm:p-2 ${
                cell.inMonth ? "" : "bg-secondary/20"
              } ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : cell.inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {cell.day}
              </span>

              {/* Dots on phones, where a chip would not fit legibly. */}
              {dayEvents.length > 0 && (
                <span className="flex flex-wrap gap-1 sm:hidden">
                  {dayEvents.slice(0, 4).map((event) => (
                    <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[event.type]}`} />
                  ))}
                </span>
              )}

              <span className="hidden min-w-0 flex-col gap-1 sm:flex">
                {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                  <span
                    key={event.id}
                    title={event.title}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${TYPE_CHIP[event.type]}`}
                  >
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > MAX_CHIPS && (
                  <span className="px-1.5 text-[10px] font-semibold text-muted-foreground">
                    +{dayEvents.length - MAX_CHIPS} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
