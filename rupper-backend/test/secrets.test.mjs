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

describe("JWT secret handling", () => {
  let warn;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("uses a strong configured secret as-is", async () => {
    const strong = "a".repeat(48);
    const { jwtSecret } = await loadSecrets({ NODE_ENV: "production", JWT_SECRET: strong });
    expect(jwtSecret).toBe(strong);
  });

  it("refuses to start in production when the secret is missing", async () => {
    await expect(loadSecrets({ NODE_ENV: "production", JWT_SECRET: "" })).rejects.toThrow(/not set/i);
  });

  it("refuses to start in production on the placeholder that ships in .env.example", async () => {
    await expect(
      loadSecrets({ NODE_ENV: "production", JWT_SECRET: "change_this_to_a_long_secret_key" })
    ).rejects.toThrow(/placeholder/i);
  });

  it("refuses the old hardcoded fallback that was public in the repository", async () => {
    await expect(loadSecrets({ NODE_ENV: "production", JWT_SECRET: "dev_secret" })).rejects.toThrow(/placeholder/i);
  });

  it("refuses a secret short enough to be worth brute forcing", async () => {
    await expect(loadSecrets({ NODE_ENV: "production", JWT_SECRET: "tooshort" })).rejects.toThrow(/32 characters/i);
  });

  it("still boots outside production so a fresh clone runs, but warns", async () => {
    const { jwtSecret } = await loadSecrets({ NODE_ENV: "development", JWT_SECRET: "" });
    expect(jwtSecret).toBeTruthy();
    expect(jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(warn).toHaveBeenCalled();
  });

  it("never falls back to a value an attacker could guess", async () => {
    const { jwtSecret } = await loadSecrets({ NODE_ENV: "development", JWT_SECRET: "" });
    expect(["dev_secret", "secret", "changeme", ""]).not.toContain(jwtSecret);
  });
});
