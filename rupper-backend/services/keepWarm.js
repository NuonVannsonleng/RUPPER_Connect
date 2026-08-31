/**
 * Keeps the service awake during the hours people actually use it.
 *
 * Render's free tier suspends a web service after 15 minutes without an inbound request, and
 * bringing it back has been measured at anywhere from 20 seconds to nearly four minutes -
 * long enough that signing in looks broken. Nothing in the app can make that boot faster, so
 * the only real fix is to stop it happening.
 *
 * This pings the service's own public URL, which arrives back through Render's edge as a
 * normal inbound request and resets the idle timer. It runs only inside a daily window
 * (06:00-23:00 Phnom Penh by default) so the instance still sleeps overnight: the free plan
 * allows 750 instance-hours a month and a service kept up around the clock would use about
 * 730 of them, leaving no margin. Seventeen hours a day is roughly 520, which covers the
 * school day with room to spare.
 *
 * This works alongside .github/workflows/keep-warm.yml rather than replacing it, and the two
 * do different halves of the job:
 *
 *   - The workflow pings from outside, so it can *wake* an instance that has already gone to
 *     sleep - overnight, or after a deploy. This process cannot do that: once suspended, it
 *     is not running to ping anything.
 *   - This timer fires on a real 10-minute interval from inside the instance, so it *keeps*
 *     a live one awake. GitHub's scheduled runs are best-effort and routinely drift well past
 *     the 15-minute idle window under load, which is why the workflow alone still left cold
 *     starts - one was measured at 22 seconds during working hours with the schedule active.
 *
 * Delete both if the service ever moves to a paid plan. Set KEEP_WARM=false to turn this half
 * off on its own.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000; // Comfortably inside Render's 15-minute idle window.
const DEFAULT_TIMEZONE = "Asia/Phnom_Penh";
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 23;

/**
 * The hour of day at `date` in `timeZone`, 0-23. Uses Intl rather than any date library, and
 * rather than the server's own clock - Render runs in UTC, which is seven hours behind the
 * people this window is meant to cover.
 */
function hourIn(timeZone, date = new Date()) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  // "24" is how some environments render midnight.
  return Number(formatted) % 24;
}

/**
 * Whether the clock is inside the awake window. Handles a window that wraps past midnight
 * (start 22, end 6) as well as an ordinary one.
 */
function isWithinActiveWindow(hour, startHour, endHour) {
  if (startHour === endHour) return true; // A zero-width window means "always".
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

/** The URL to ping. Render sets RENDER_EXTERNAL_URL itself, so this usually needs no config. */
function resolvePublicUrl() {
  const base = (process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || "").trim();
  if (!base || !/^https?:\/\//i.test(base)) return null;
  return `${base.replace(/\/+$/, "")}/api/health`;
}

function startKeepWarm() {
  if (process.env.KEEP_WARM === "false") {
    return { enabled: false, reason: "disabled by KEEP_WARM=false" };
  }
  // Locally the service is not reachable from itself over the public internet, and there is
  // nothing to keep awake anyway.
  if (process.env.NODE_ENV !== "production") {
    return { enabled: false, reason: "not production" };
  }

  const url = resolvePublicUrl();
  if (!url) {
    return { enabled: false, reason: "no RENDER_EXTERNAL_URL or BACKEND_URL to ping" };
  }

  const timeZone = process.env.KEEP_WARM_TIMEZONE || DEFAULT_TIMEZONE;
  const startHour = Number(process.env.KEEP_WARM_START_HOUR ?? DEFAULT_START_HOUR);
  const endHour = Number(process.env.KEEP_WARM_END_HOUR ?? DEFAULT_END_HOUR);

  const tick = async () => {
    if (!isWithinActiveWindow(hourIn(timeZone), startHour, endHour)) return;
    try {
      // The response is irrelevant - the request itself is what resets the idle timer.
      await fetch(url, { method: "GET", headers: { "user-agent": "rupper-keep-warm" } });
    } catch (error) {
      // A failed ping is not worth escalating: the next one is ten minutes away, and a real
      // request from a person would wake it regardless.
      console.warn("Keep-warm ping failed:", error.message);
    }
  };

  const timer = setInterval(tick, PING_INTERVAL_MS);
  // Never hold the process open on account of this.
  if (typeof timer.unref === "function") timer.unref();

  return { enabled: true, url, timeZone, startHour, endHour };
}

module.exports = { startKeepWarm, isWithinActiveWindow, hourIn };
