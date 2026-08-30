import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { ApiError, apiRequest, TOKEN_KEY } from "@/lib/api";

/**
 * The retry rules exist because the backend sleeps: Render's edge answers 502 while the
 * instance behind it starts, and the sign-in that hit that window used to fail outright.
 *
 * What matters is that repeating a request is only ever safe when nothing can have happened
 * yet, so these pin down both halves - the gateway statuses that are always safe to repeat,
 * and the dropped connections that are only safe to repeat for a read.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Real timers make the 2s/4s backoff take six seconds; the waiting itself isn't the subject. */
const runWithBackoff = async <T,>(promise: Promise<T>) => {
  await vi.advanceTimersByTimeAsync(10_000);
  return promise;
};

/** Awaits a request expected to fail and hands back the typed error it threw. */
const failureOf = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the request to fail, but it resolved");
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a request that works", () => {
  it("returns the parsed body", async () => {
    fetchMock.mockResolvedValue(json({ id: "1", title: "Quiz" }));
    await expect(apiRequest("/academic/quizzes/1")).resolves.toEqual({ id: "1", title: "Quiz" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the stored token, and manages without one", async () => {
    fetchMock.mockResolvedValue(json({}));

    localStorage.setItem(TOKEN_KEY, "a-token");
    await apiRequest("/auth/me");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer a-token");

    localStorage.clear();
    await apiRequest("/auth/me");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
});

describe("a request the server refuses", () => {
  it("reports the status and the server's own message, without retrying", async () => {
    fetchMock.mockResolvedValue(json({ message: "Invalid email or password" }, 400));

    const error = await failureOf(apiRequest("/auth/login", { method: "POST" }));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid email or password");
    // A rejection is an answer. Asking again would only produce the same one.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes a 401 through so the caller can end the session", async () => {
    fetchMock.mockResolvedValue(json({ message: "Invalid or expired token" }, 401));
    const error = await failureOf(apiRequest("/auth/me"));
    expect(error.status).toBe(401);
  });
});

describe("a server that is still waking up", () => {
  it("retries a 502 and succeeds once the instance is up", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json({ user: { name: "Sonleng" } }));

    const result = await runWithBackoff(apiRequest("/auth/me"));

    expect(result).toEqual({ user: { name: "Sonleng" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // The gateway answered, so Express never saw the request - nothing can have been created,
  // which is what makes repeating a POST safe here and nowhere else.
  it("retries a 502 even on a sign-in, which is the case that was failing", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json({ token: "t", user: { name: "Sonleng" } }));

    const result = await runWithBackoff(apiRequest("/auth/login", { method: "POST" }));

    expect(result).toMatchObject({ token: "t" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after the last attempt rather than retrying forever", async () => {
    fetchMock.mockResolvedValue(json({}, 502));

    const rejection = failureOf(apiRequest("/auth/me"));
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await rejection;

    expect(error.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(error.message).toMatch(/starting up/i);
  });
});

describe("a connection that drops", () => {
  it("retries a read, where repeating it cannot change anything", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json({ ok: true }));

    await expect(runWithBackoff(apiRequest("/academic/quizzes"))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // The server may well have acted on it before the connection went; sending it again could
  // submit the same quiz attempt twice.
  it("does not retry a write, because it may already have been carried out", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await failureOf(apiRequest("/academic/quizzes/1/attempts", { method: "POST" }));

    expect(error.isNetwork).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains itself in a way that names the likely cause", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await failureOf(apiRequest("/auth/login", { method: "POST" }));
    expect(error.message).toMatch(/could not reach the server/i);
  });
});

describe("opting out", () => {
  it("honours retry:false, which the warm-up nudge relies on", async () => {
    fetchMock.mockResolvedValue(json({}, 502));

    const error = await failureOf(apiRequest("/health", { retry: false }));

    expect(error.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
