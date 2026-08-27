import { buildApiUrl } from "@/lib/api";

/**
 * Nudges the API awake as early as possible.
 *
 * The backend runs on a free Render instance, which is suspended after 15 minutes of no
 * traffic and can take several minutes to come back - it is hosted in US-West while the
 * database is in Singapore, so its start-up queries cross the Pacific. Nothing is broken
 * while that happens, but the first request of the day simply hangs, and someone signing in
 * sees a frozen "Signing in..." and gives up before it lands.
 *
 * Firing this the moment an auth screen mounts means the wake overlaps with the time it
 * takes to type an email and password, rather than starting after the submit.
 */

let started = false;

/** Fire-and-forget. Safe to call repeatedly; only the first call does anything. */
export function warmUpApi() {
  if (started) return;
  started = true;

  // Deliberately unawaited and errors swallowed: this is a nudge, not a dependency. A failure
  // here must never block or surface anywhere - the real request reports its own problems.
  void fetch(buildApiUrl("/health"), { method: "GET", cache: "no-store" }).catch(() => undefined);
}

/** Test seam - lets a test start from a clean slate. */
export function resetWarmUpForTests() {
  started = false;
}
