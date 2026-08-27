import { describe, it, expect } from "vitest";

import {
  addMonths,
  buildMonthGrid,
  canGoBack,
  canGoForward,
  clampCursor,
  groupByDate,
  MAX_YEAR,
  MIN_YEAR,
  monthLabel,
  selectableYears,
  toIso,
} from "@/lib/calendarMonth";

describe("month grid", () => {
  it("always returns six full weeks, so paging months never changes the grid height", () => {
    for (const month of [0, 1, 5, 11]) {
      expect(buildMonthGrid({ year: 2026, month })).toHaveLength(42);
    }
  });

  it("starts the grid on the Monday on or before the 1st", () => {
    // 1 Aug 2026 is a Saturday, so the grid opens on Monday 27 July.
    const grid = buildMonthGrid({ year: 2026, month: 7 });
    expect(grid[0].iso).toBe("2026-07-27");
    expect(grid[0].inMonth).toBe(false);
  });

  it("marks only the month's own days as inMonth", () => {
    const grid = buildMonthGrid({ year: 2026, month: 7 });
    const own = grid.filter((cell) => cell.inMonth);
    expect(own).toHaveLength(31);
    expect(own[0].iso).toBe("2026-08-01");
    expect(own[30].iso).toBe("2026-08-31");
  });

  it("handles a month that begins on a Monday with no leading days", () => {
    // 1 June 2026 is a Monday.
    const grid = buildMonthGrid({ year: 2026, month: 5 });
    expect(grid[0].iso).toBe("2026-06-01");
    expect(grid[0].inMonth).toBe(true);
  });

  it("gets February right in a leap year and a common year", () => {
    expect(buildMonthGrid({ year: 2028, month: 1 }).filter((c) => c.inMonth)).toHaveLength(29);
    expect(buildMonthGrid({ year: 2026, month: 1 }).filter((c) => c.inMonth)).toHaveLength(28);
  });

  it("produces local dates, not UTC-shifted ones", () => {
    // toISOString() would render 1 Jan as 31 Dec for anyone east of Greenwich.
    const grid = buildMonthGrid({ year: 2027, month: 0 });
    expect(grid.find((cell) => cell.inMonth)?.iso).toBe("2027-01-01");
  });

  it("runs continuously across a year boundary", () => {
    const december = buildMonthGrid({ year: 2026, month: 11 }).filter((c) => c.inMonth);
    expect(december[december.length - 1].iso).toBe("2026-12-31");
    const january = buildMonthGrid({ year: 2027, month: 0 }).filter((c) => c.inMonth);
    expect(january[0].iso).toBe("2027-01-01");
  });
});

describe("navigation range", () => {
  it("rolls over the year in both directions", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths({ year: 2026, month: 3 }, 12)).toEqual({ year: 2027, month: 3 });
  });

  it("stops at the ends of the browsable range instead of running past them", () => {
    expect(addMonths({ year: MAX_YEAR, month: 11 }, 1)).toEqual({ year: MAX_YEAR, month: 11 });
    expect(addMonths({ year: MIN_YEAR, month: 0 }, -1)).toEqual({ year: MIN_YEAR, month: 0 });
    expect(clampCursor({ year: 2099, month: 5 })).toEqual({ year: MAX_YEAR, month: 11 });
  });

  it("reaches 2030, which is the point of the range", () => {
    expect(canGoForward({ year: 2029, month: 11 })).toBe(true);
    expect(canGoForward({ year: MAX_YEAR, month: 10 })).toBe(true);
    expect(canGoForward({ year: MAX_YEAR, month: 11 })).toBe(false);
    expect(selectableYears()).toContain(2030);
    expect(selectableYears().at(-1)).toBe(2030);
  });

  it("knows when it cannot go further back", () => {
    expect(canGoBack({ year: MIN_YEAR, month: 0 })).toBe(false);
    expect(canGoBack({ year: MIN_YEAR, month: 1 })).toBe(true);
  });

  it("labels the month for the header", () => {
    expect(monthLabel({ year: 2030, month: 11 })).toBe("December 2030");
  });
});

describe("helpers", () => {
  it("pads the ISO parts", () => {
    expect(toIso(2026, 0, 5)).toBe("2026-01-05");
    expect(toIso(2026, 11, 31)).toBe("2026-12-31");
  });

  it("buckets events by their date", () => {
    const grouped = groupByDate([
      { date: "2026-08-01", id: "a" },
      { date: "2026-08-01", id: "b" },
      { date: "2026-08-02", id: "c" },
    ]);
    expect(grouped.get("2026-08-01")).toHaveLength(2);
    expect(grouped.get("2026-08-02")).toHaveLength(1);
    expect(grouped.get("2026-08-03")).toBeUndefined();
  });
});
