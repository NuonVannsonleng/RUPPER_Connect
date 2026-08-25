import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

/**
 * What happens when a student's token is pointed at a teacher-only or admin-only endpoint.
 *
 * The guards are plain middleware, so these drive them directly rather than standing up an
 * HTTP server - the assertion is the same one the routers rely on: a non-matching role never
 * reaches the controller, and the status is 403 rather than a silent pass-through.
 *
 * The second group is the one worth keeping an eye on. `role` is a claim inside the JWT, minted
 * at login and valid for seven days, so on its own it is a snapshot that goes stale the moment
 * an admin changes somebody's role. middleware/auth.js re-reads the role from the database on
 * every request; these cases pin that down in both directions - a promotion takes effect
 * without re-logging-in, and a demotion (or a token whose claim simply disagrees with the
 * database) cannot be used to keep privileges.
 *
 * Neither module is mocked. config/secrets.js reads JWT_SECRET at import time and config/db.js
 * exports a single pool object, so setting the environment and then swapping that object's
 * `query` is enough - and it exercises the real modules rather than a stand-in. Both have to
 * happen before middleware/auth.js is imported, hence the dynamic imports below.
 */

const SECRET = "test-secret-long-enough-to-pass-the-32-character-check";

process.env.JWT_SECRET = SECRET;
// Never connected to: the pool is constructed lazily and its query method is replaced below.
// Set so config/db.js doesn't throw for missing configuration, and so a stray query can't
// reach a real database. dotenv doesn't overwrite variables that are already set.
process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/unused";

/** What the database reports for the account behind the token, set per test. */
let dbUser = null;

const pool = (await import("../config/db.js")).default;
pool.query = async () => [dbUser ? [dbUser] : [], []];

const authMiddleware = (await import("../middleware/auth.js")).default;
const requireAdmin = (await import("../middleware/requireAdmin.js")).default;
const requireTeacher = (await import("../middleware/requireTeacher.js")).default;

/** Minimal express res double: records the status and body the middleware produced. */
const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const run = (middleware, req) => {
  const res = makeRes();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

const runAsync = async (middleware, req) => {
  const res = makeRes();
  let nextCalled = false;
  let nextError = null;
  await middleware(req, res, (err) => {
    nextCalled = true;
    nextError = err ?? null;
  });
  return { res, nextCalled, nextError };
};

const requestWithClaims = (claims, secret = SECRET) => ({
  header: () => `Bearer ${jwt.sign(claims, secret)}`,
});

describe("role guards reject the wrong role", () => {
  it("blocks a student from an admin-only route", () => {
    const { res, nextCalled } = run(requireAdmin, { user: { id: 7, role: "student" } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/admin/i);
  });

  it("blocks a student from a teacher-only route", () => {
    const { res, nextCalled } = run(requireTeacher, { user: { id: 7, role: "student" } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("blocks a teacher from an admin-only route", () => {
    const { nextCalled } = run(requireAdmin, { user: { id: 8, role: "teacher" } });
    expect(nextCalled).toBe(false);
  });

  it("lets a teacher through a teacher-only route, and an admin through both", () => {
    expect(run(requireTeacher, { user: { id: 8, role: "teacher" } }).nextCalled).toBe(true);
    expect(run(requireTeacher, { user: { id: 9, role: "admin" } }).nextCalled).toBe(true);
    expect(run(requireAdmin, { user: { id: 9, role: "admin" } }).nextCalled).toBe(true);
  });

  it("blocks a request that carries no authenticated user at all", () => {
    expect(run(requireAdmin, {}).nextCalled).toBe(false);
    expect(run(requireTeacher, {}).nextCalled).toBe(false);
  });
});

describe("the database, not the token, decides the role", () => {
  beforeEach(() => {
    dbUser = null;
  });

  it("uses the promoted role even though the token still says student", async () => {
    dbUser = { role: "admin", is_active: true, password_changed_at: null };
    const req = requestWithClaims({ id: 7, role: "student" });

    const { nextCalled, nextError } = await runAsync(authMiddleware, req);

    expect(nextError).toBeNull();
    expect(nextCalled).toBe(true);
    expect(req.user.role).toBe("admin");
    // ...and so the admin guard now lets them through without signing in again.
    expect(run(requireAdmin, req).nextCalled).toBe(true);
  });

  it("ignores an admin claim once the account has been demoted", async () => {
    dbUser = { role: "student", is_active: true, password_changed_at: null };
    const req = requestWithClaims({ id: 7, role: "admin" });

    await runAsync(authMiddleware, req);

    expect(req.user.role).toBe("student");
    expect(run(requireAdmin, req).nextCalled).toBe(false);
  });

  it("refuses a token for an account that no longer exists", async () => {
    dbUser = null;

    const { res, nextCalled } = await runAsync(authMiddleware, requestWithClaims({ id: 7, role: "admin" }));

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("refuses a token for an account that has been deactivated", async () => {
    dbUser = { role: "admin", is_active: false, password_changed_at: null };

    const { res, nextCalled } = await runAsync(authMiddleware, requestWithClaims({ id: 7, role: "admin" }));

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("refuses a token minted before the account's last password change", async () => {
    dbUser = { role: "student", is_active: true, password_changed_at: new Date(Date.now() + 60_000) };

    const { res, nextCalled } = await runAsync(authMiddleware, requestWithClaims({ id: 7, role: "student" }));

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("refuses a token signed with the wrong secret", async () => {
    dbUser = { role: "admin", is_active: true, password_changed_at: null };

    const { res, nextCalled } = await runAsync(
      authMiddleware,
      requestWithClaims({ id: 7, role: "admin" }, "not-the-real-secret")
    );

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("refuses a request with no token at all", async () => {
    const { res, nextCalled } = await runAsync(authMiddleware, { header: () => undefined });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});
