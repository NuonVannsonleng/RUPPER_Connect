import { describe, it, expect } from "vitest";

import { clockTime, dayLabel, isNewDay, parseSentAt } from "@/lib/chatTime";

/**
 * Message timestamps come back as the raw Postgres value - `YYYY-MM-DD HH:MM:SS.ffffff`, in
 * UTC, with nothing marking it as UTC. The database was checked: its TimeZone is UTC. Reading
 * that string as local time would date every message by the viewer's offset, which is seven
 * hours in Cambodia, so a message sent a moment ago would show as this morning.
 */
describe("parsing a stored timestamp", () => {
  it("reads a bare Postgres timestamp as UTC, not as local time", () => {
    expect(parseSentAt("2026-08-27 04:43:55.278614").toISOString()).toBe("2026-08-27T04:43:55.278Z");
  });

  it("accepts the ISO form too", () => {
    expect(parseSentAt("2026-08-27T04:43:55Z").toISOString()).toBe("2026-08-27T04:43:55.000Z");
  });

  it("does not double up a zone that is already there", () => {
    expect(parseSentAt("2026-08-27T04:43:55+07:00").toISOString()).toBe("2026-08-26T21:43:55.000Z");
  });

  it("returns an invalid date rather than throwing on junk", () => {
    expect(Number.isNaN(parseSentAt("").getTime())).toBe(true);
    expect(Number.isNaN(parseSentAt("not a date").getTime())).toBe(true);
  });
});

describe("day separators", () => {
  it("labels today and yesterday", () => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().replace("T", " ").slice(0, 23);
    expect(dayLabel(iso(now))).toBe("Today");
    expect(dayLabel(iso(new Date(now.getTime() - 86400000)))).toBe("Yesterday");
  });

  it("falls back to a full date further back", () => {
    expect(dayLabel("2020-03-04 10:00:00")).toMatch(/2020/);
  });

  it("starts a new day before the first message", () => {
    expect(isNewDay(undefined, "2026-08-27 04:00:00")).toBe(true);
  });

  // Built from real instants rather than fixed strings, because the boundary that matters is
  // the viewer's local midnight, not UTC's - two UTC timestamps either side of 00:00Z are the
  // same day for anyone at UTC+7, and the separator should follow what the reader sees.
  it("separates messages that fall on different local days", () => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().replace("T", " ").slice(0, 23);
    expect(isNewDay(iso(new Date(now.getTime() - 86400000)), iso(now))).toBe(true);
  });

  it("does not separate two messages from the same local day", () => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().replace("T", " ").slice(0, 23);
    expect(isNewDay(iso(new Date(now.getTime() - 60000)), iso(now))).toBe(false);
  });
});

describe("clock time", () => {
  it("renders something time-shaped", () => {
    expect(clockTime("2026-08-27 04:43:55")).toMatch(/\d{1,2}[:.]\d{2}/);
  });

  it("is blank for an unparseable value rather than showing Invalid Date", () => {
    expect(clockTime("nope")).toBe("");
  });
});
