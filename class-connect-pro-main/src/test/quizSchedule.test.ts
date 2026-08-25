import { describe, it, expect } from "vitest";

import { availabilityAt, describeSchedule, formatDistance, isoToLocalInput, localInputToIso } from "@/lib/quizSchedule";

const NOW = Date.parse("2026-08-25T12:00:00Z");
const at = (iso: string) => Date.parse(iso);

describe("availabilityAt", () => {
  it("is available when published with no window", () => {
    expect(availabilityAt("available", null, null, NOW)).toBe("available");
  });

  it("waits for the opening time, then opens on its own", () => {
    expect(availabilityAt("available", "2026-08-25T14:00:00Z", null, NOW)).toBe("scheduled");
    expect(availabilityAt("available", "2026-08-25T14:00:00Z", null, at("2026-08-25T14:00:01Z"))).toBe("available");
  });

  it("closes once the closing time passes", () => {
    expect(availabilityAt("available", null, "2026-08-25T13:00:00Z", NOW)).toBe("available");
    expect(availabilityAt("available", null, "2026-08-25T13:00:00Z", at("2026-08-25T13:00:00Z"))).toBe("closed");
  });

  it("keeps a draft hidden, and a hand-closed quiz closed, whatever the window says", () => {
    expect(availabilityAt("draft", "2026-08-25T10:00:00Z", "2026-08-25T18:00:00Z", NOW)).toBe("draft");
    expect(availabilityAt("closed", "2026-08-25T10:00:00Z", "2026-08-25T18:00:00Z", NOW)).toBe("closed");
  });
});

describe("describeSchedule", () => {
  it("says nothing when the quiz has no window", () => {
    expect(describeSchedule({}, "available", NOW)).toBeNull();
  });

  it("counts down to the opening time", () => {
    const label = describeSchedule({ opensAt: "2026-08-25T14:30:00Z" }, "scheduled", NOW);
    expect(label?.text).toMatch(/^Opens in 2h 30m/);
    expect(label?.tone).toBe("info");
  });

  it("counts down to the closing time while the quiz is open", () => {
    const label = describeSchedule({ closesAt: "2026-08-25T12:15:00Z" }, "available", NOW);
    expect(label?.text).toMatch(/^Closes in 15m/);
    expect(label?.tone).toBe("warning");
  });

  // The regression this file was added for: closing a quiz by hand leaves a closing time in
  // the future, and the label used to read that alone and carry on counting down on a quiz
  // that was already shut.
  it("stops counting down once the quiz is closed early", () => {
    const label = describeSchedule({ closesAt: "2026-08-25T12:20:00Z" }, "closed", NOW);
    expect(label?.text).not.toMatch(/Closes in/);
    expect(label?.text).toMatch(/^Closed early/);
    expect(label?.tone).toBe("muted");
  });

  it("reports a quiz closed by its own deadline as simply closed", () => {
    const label = describeSchedule({ closesAt: "2026-08-25T11:00:00Z" }, "closed", NOW);
    expect(label?.text).toMatch(/^Closed /);
    expect(label?.text).not.toMatch(/early/);
  });

  it("describes a draft's window as a plan rather than a countdown", () => {
    const label = describeSchedule({ opensAt: "2026-08-25T14:00:00Z" }, "draft", NOW);
    expect(label?.text).toMatch(/^Draft - set to open/);
    expect(label?.text).not.toMatch(/Opens in/);
  });

  it("notes when an open-ended quiz opened", () => {
    const label = describeSchedule({ opensAt: "2026-08-25T09:00:00Z" }, "available", NOW);
    expect(label?.text).toMatch(/^Opened /);
  });
});

describe("formatDistance", () => {
  it("keeps to the two largest units that matter", () => {
    expect(formatDistance(2 * 86_400_000 + 4 * 3_600_000)).toBe("2d 4h");
    expect(formatDistance(15 * 60_000 + 30_000)).toBe("15m 30s");
    expect(formatDistance(45_000)).toBe("45s");
  });

  it("never renders a negative remainder", () => {
    expect(formatDistance(-5000)).toBe("0s");
  });
});

describe("datetime-local round trip", () => {
  it("returns an instant unchanged through both conversions", () => {
    // Built from local parts so the assertion holds in whatever zone the tests run in.
    const local = new Date(2026, 7, 25, 14, 30);
    const iso = local.toISOString();
    expect(localInputToIso(isoToLocalInput(iso))).toBe(iso.replace(/\.\d{3}Z$/, ".000Z"));
  });

  it("treats an empty field as no bound", () => {
    expect(localInputToIso("")).toBeNull();
    expect(isoToLocalInput(null)).toBe("");
  });
});
