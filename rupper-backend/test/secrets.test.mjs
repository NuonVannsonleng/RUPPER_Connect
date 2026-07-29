import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * config/secrets.js decides at import time, so each case needs a fresh module registry.
 */
const loadSecrets = async (env) => {
  vi.resetModules();
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    const mod = await import("../config/secrets.js");
    return mod.default ?? mod;
  } finally {
    process.env = previous;
  }
};

const WEAK = ["", "dev_secret", "change_this_to_a_long_secret_key", "tooshort"];

describe("JWT secret handling", () => {
  let warn;
  let error;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it("uses a strong configured secret as-is", async () => {
    const strong = "a".repeat(48);
    const { jwtSecret } = await loadSecrets({ NODE_ENV: "production", JWT_SECRET: strong });
    expect(jwtSecret).toBe(strong);
  });

  it.each(WEAK)("never keeps a weak or missing secret (%j)", async (value) => {
    // The heart of the original bug: a guessable signing key lets anyone mint a token for
    // any account. Whatever else happens, the resolved secret must not be that value.
    const { jwtSecret } = await loadSecrets({ NODE_ENV: "production", JWT_SECRET: value });
    expect(jwtSecret).not.toBe(value);
    expect(jwtSecret.length).toBeGreaterThanOrEqual(32);
  });

  it("stays up rather than crashing when production is misconfigured", async () => {
    // Refusing to boot turns a config mistake into a total outage - which is exactly how
    // this took the site down once. It must start, on a random secret, and say so loudly.
    const { jwtSecret } = await loadSecrets({ NODE_ENV: "production", JWT_SECRET: "" });
    expect(jwtSecret).toBeTruthy();
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0][0])).toMatch(/SECURITY/);
  });

  it("generates a different secret each time, so nothing is predictable", async () => {
    const a = await loadSecrets({ NODE_ENV: "production", JWT_SECRET: "" });
    const b = await loadSecrets({ NODE_ENV: "production", JWT_SECRET: "" });
    expect(a.jwtSecret).not.toBe(b.jwtSecret);
  });

  it("warns rather than errors outside production", async () => {
    const { jwtSecret } = await loadSecrets({ NODE_ENV: "development", JWT_SECRET: "" });
    expect(jwtSecret).toBeTruthy();
    expect(warn).toHaveBeenCalled();
  });
});
