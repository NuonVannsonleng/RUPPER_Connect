import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { warmUpApi, resetWarmUpForTests } from "@/lib/warmup";

describe("API warm-up", () => {
  beforeEach(() => {
    resetWarmUpForTests();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pings the health endpoint", () => {
    warmUpApi();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain("/health");
  });

  it("only fires once, however many screens ask for it", () => {
    warmUpApi();
    warmUpApi();
    warmUpApi();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("swallows a failure - a warm-up must never surface an error", async () => {
    resetWarmUpForTests();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(() => warmUpApi()).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
