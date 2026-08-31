import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { isWithinActiveWindow, hourIn, startKeepWarm } = require("../services/keepWarm.js");

/**
 * The window is what keeps this inside the free plan's 750 instance-hours a month. Awake
 * around the clock is roughly 730 of them with no margin; 06:00-23:00 is about 520.
 */
describe("active window", () => {
  it("is awake through the school day", () => {
    for (const hour of [6, 9, 12, 17, 22]) {
      expect(isWithinActiveWindow(hour, 6, 23)).toBe(true);
    }
  });

  it("is asleep overnight", () => {
    for (const hour of [23, 0, 3, 5]) {
      expect(isWithinActiveWindow(hour, 6, 23)).toBe(false);
    }
  });

  it("includes the opening hour and excludes the closing one", () => {
    expect(isWithinActiveWindow(6, 6, 23)).toBe(true);
    expect(isWithinActiveWindow(23, 6, 23)).toBe(false);
  });

  it("handles a window that wraps past midnight", () => {
    // 22:00 to 06:00
    expect(isWithinActiveWindow(23, 22, 6)).toBe(true);
    expect(isWithinActiveWindow(2, 22, 6)).toBe(true);
    expect(isWithinActiveWindow(12, 22, 6)).toBe(false);
  });

  it("treats a zero-width window as always awake", () => {
    for (const hour of [0, 11, 23]) {
      expect(isWithinActiveWindow(hour, 9, 9)).toBe(true);
    }
  });
});

describe("time zone handling", () => {
  it("reads the hour where the users are, not where the server runs", () => {
    // Render runs in UTC; Phnom Penh is seven hours ahead. 20:00 UTC is 03:00 there, which is
    // outside the window even though the server's own clock says early evening.
    const atEightPmUtc = new Date("2026-08-27T20:00:00Z");
    expect(hourIn("UTC", atEightPmUtc)).toBe(20);
    expect(hourIn("Asia/Phnom_Penh", atEightPmUtc)).toBe(3);
    expect(isWithinActiveWindow(hourIn("Asia/Phnom_Penh", atEightPmUtc), 6, 23)).toBe(false);
  });

  it("wraps midnight to 0 rather than 24", () => {
    expect(hourIn("UTC", new Date("2026-08-27T00:30:00Z"))).toBe(0);
  });
});

describe("startup guards", () => {
  const withEnv = (env, run) => {
    const previous = { ...process.env };
    Object.assign(process.env, env);
    try {
      return run();
    } finally {
      process.env = previous;
    }
  };

  it("stays off outside production - nothing local needs keeping awake", () => {
    const result = withEnv({ NODE_ENV: "development", RENDER_EXTERNAL_URL: "https://x.onrender.com" }, startKeepWarm);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/production/);
  });

  it("can be switched off outright", () => {
    const result = withEnv(
      { NODE_ENV: "production", KEEP_WARM: "false", RENDER_EXTERNAL_URL: "https://x.onrender.com" },
      startKeepWarm
    );
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/KEEP_WARM/);
  });

  it("stays off when it has no address to ping", () => {
    const result = withEnv({ NODE_ENV: "production", RENDER_EXTERNAL_URL: "", BACKEND_URL: "" }, startKeepWarm);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/URL/);
  });

  it("uses the URL Render provides, without needing to be configured", () => {
    const result = withEnv({ NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://x.onrender.com" }, startKeepWarm);
    expect(result.enabled).toBe(true);
    expect(result.url).toBe("https://x.onrender.com/api/health");
  });

  it("does not double the slash when the URL has a trailing one", () => {
    const result = withEnv({ NODE_ENV: "production", BACKEND_URL: "https://x.onrender.com/" }, startKeepWarm);
    expect(result.url).toBe("https://x.onrender.com/api/health");
  });
});
