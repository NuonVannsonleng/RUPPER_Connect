export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const TOKEN_KEY = "rupper_auth_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Carries the HTTP status alongside the message, which callers need in order to tell a real
 * rejection from the API apart from the API simply not being there yet. Signing someone out
 * because their session was refused is right; signing them out because the server was asleep
 * is not, and without the status those two look identical.
 */
export class ApiError extends Error {
  readonly status: number;
  /** True when nothing was decided: the request never reached the app, or never came back. */
  readonly isNetwork: boolean;

  constructor(message: string, status: number, isNetwork = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

/**
 * The backend sleeps on Render's free plan and takes roughly half a minute to come back, so
 * this is generous on purpose. It is a backstop against a request that will never land, not a
 * performance budget - cutting it short would only turn a slow sign-in into a failed one.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Statuses Render's edge returns while the instance behind it is still starting. The request
 * never reached Express, so nothing happened and repeating it is safe even for a POST.
 */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

const RETRY_DELAYS_MS = [2_000, 4_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isReadOnly = (method: string) => method === "GET" || method === "HEAD";

export interface ApiRequestOptions extends RequestInit {
  /** Overrides the per-attempt timeout. */
  timeoutMs?: number;
  /** Set false to fail on the first attempt - used by the warm-up nudge. */
  retry?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, retry = true, ...init } = options;
  const method = (init.method || "GET").toUpperCase();

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await attemptRequest<T>(path, init, timeoutMs);
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError(messageFrom(error), 0, true);
      lastError = apiError;

      const canRetry = retry && attempt < RETRY_DELAYS_MS.length && isRetryable(apiError, method);
      if (!canRetry) throw apiError;

      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError ?? new ApiError("Request failed", 0, true);
}

/**
 * A gateway status means the app never saw the request, so anything may be repeated. A dropped
 * or timed-out connection is murkier - the server may well have acted on it - so that is only
 * repeated for reads, where doing it twice cannot create or change anything.
 */
const isRetryable = (error: ApiError, method: string) => {
  if (GATEWAY_STATUSES.has(error.status)) return true;
  return error.isNetwork && isReadOnly(method);
};

const messageFrom = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The server is taking too long to respond. It may be waking up - please try again.";
  }
  return "Could not reach the server. Check your connection and try again.";
};

async function attemptRequest<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const token = getToken();
  // AbortSignal.timeout isn't in every browser this has to run on, so the controller is wired
  // up by hand and always cleared - an uncleared timer would abort a later, unrelated request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { message?: string }).message || fallbackMessage(res.status),
      res.status
    );
  }
  return data as T;
}

const fallbackMessage = (status: number) =>
  GATEWAY_STATUSES.has(status)
    ? "The server is starting up. Please try again in a moment."
    : "Request failed";
