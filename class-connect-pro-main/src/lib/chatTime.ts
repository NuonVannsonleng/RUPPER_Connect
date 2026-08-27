/**
 * Timestamp formatting for the chat.
 *
 * Message timestamps arrive as `YYYY-MM-DD HH:MM:SS[.ffffff]` - the raw Postgres value, in
 * UTC, with no zone marker on it. Left alone, `new Date(...)` reads that as *local* time, so
 * a message sent a minute ago in Phnom Penh would read as seven hours old. Normalising it to
 * an ISO instant first is what keeps "2 min ago" honest.
 */

export const parseSentAt = (value: string): Date => {
  if (!value) return new Date(NaN);
  const normalised = value.includes("T") ? value : value.replace(" ", "T");
  // Add the zone only when the string doesn't already carry one.
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalised) ? normalised : `${normalised}Z`;
  return new Date(withZone);
};

/** `14:32` - the time under a bubble. */
export const clockTime = (value: string) => {
  const date = parseSentAt(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** "Today" / "Yesterday" / "12 Aug 2026" - the separator between days in a thread. */
export const dayLabel = (value: string) => {
  const date = parseSentAt(value);
  if (Number.isNaN(date.getTime())) return "";

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Compact age for the conversation list: `14:32` today, `Mon` this week, else `12 Aug`. */
export const conversationTime = (value: string) => {
  const date = parseSentAt(value);
  if (Number.isNaN(date.getTime())) return "";

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86400000);

  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** True when two messages fall on different calendar days, so a separator belongs between. */
export const isNewDay = (previous: string | undefined, current: string) => {
  if (!previous) return true;
  const a = parseSentAt(previous);
  const b = parseSentAt(current);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.toDateString() !== b.toDateString();
};
