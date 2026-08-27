/**
 * Month-grid maths for the academic calendar.
 *
 * Every date here is a plain `YYYY-MM-DD` string, which is how the API stores and returns
 * them. Dates are built with the local-time Date constructor and formatted by hand rather
 * than through toISOString(), which would convert to UTC and shift the day backwards for
 * anyone east of Greenwich - Cambodia is UTC+7, so that would be every user of this app.
 */

/** The calendar can be browsed across this range. */
export const MIN_YEAR = 2020;
export const MAX_YEAR = 2030;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Monday first, matching how the schedule page orders its days. */
export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const toIso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Today as `YYYY-MM-DD` in the viewer's own time zone. */
export const todayIso = () => {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
};

export interface MonthCursor {
  year: number;
  month: number; // 0-11
}

/** Keeps a cursor inside [MIN_YEAR, MAX_YEAR] so navigation can't run off either end. */
export const clampCursor = ({ year, month }: MonthCursor): MonthCursor => {
  if (year < MIN_YEAR) return { year: MIN_YEAR, month: 0 };
  if (year > MAX_YEAR) return { year: MAX_YEAR, month: 11 };
  return { year, month };
};

/** Steps by whole months, rolling the year over, then clamps to the browsable range. */
export const addMonths = (cursor: MonthCursor, delta: number): MonthCursor => {
  const total = cursor.year * 12 + cursor.month + delta;
  return clampCursor({ year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 });
};

export const canGoBack = (cursor: MonthCursor) => cursor.year > MIN_YEAR || cursor.month > 0;
export const canGoForward = (cursor: MonthCursor) => cursor.year < MAX_YEAR || cursor.month < 11;

export const monthLabel = ({ year, month }: MonthCursor) => `${MONTH_NAMES[month]} ${year}`;

export interface MonthCell {
  iso: string;
  day: number;
  /** False for the leading/trailing days borrowed from the neighbouring months. */
  inMonth: boolean;
}

/**
 * Builds the six-week grid a month is drawn on, including the days either side needed to
 * fill the first and last weeks. Always 42 cells, so the grid never changes height as you
 * page through months.
 */
export function buildMonthGrid({ year, month }: MonthCursor): MonthCell[] {
  const firstOfMonth = new Date(year, month, 1);
  // getDay() is 0=Sunday; shift so Monday is 0.
  const leading = (firstOfMonth.getDay() + 6) % 7;

  const cells: MonthCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, 1 - leading + index);
    cells.push({
      iso: toIso(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === month && date.getFullYear() === year,
    });
  }
  return cells;
}

/** Groups anything carrying a `date` by that date, for O(1) lookup per grid cell. */
export function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const existing = byDate.get(item.date);
    if (existing) existing.push(item);
    else byDate.set(item.date, [item]);
  }
  return byDate;
}

/** The years offered in the picker, oldest first. */
export const selectableYears = () =>
  Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => MIN_YEAR + index);

/** A readable date for headings, e.g. "Monday, 27 August 2026". */
export const formatLongDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
