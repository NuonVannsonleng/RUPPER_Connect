import type { QuizAvailability } from "@/data/academicPlatform";

/**
 * The client's half of quiz scheduling.
 *
 * The server decides what a quiz actually is - `availability` on every quiz it returns is
 * authoritative, and both the detail fetch and the submit endpoint enforce it. What this adds
 * is a clock: recomputing the same rule locally lets a card flip from "opens in 4s" to "Take
 * quiz" on its own, instead of looking shut until the page is reloaded.
 */
export const availabilityAt = (
  status: string | undefined,
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
  now: number
): QuizAvailability => {
  if (status === "draft") return "draft";
  if (status === "closed") return "closed";
  if (opensAt && now < Date.parse(opensAt)) return "scheduled";
  if (closesAt && now >= Date.parse(closesAt)) return "closed";
  return "available";
};

const UNITS: Array<[label: string, ms: number]> = [
  ["d", 86_400_000],
  ["h", 3_600_000],
  ["m", 60_000],
  ["s", 1000],
];

/** "2d 4h", "18m 30s" - the two largest units that aren't zero, which reads well at any range. */
export const formatDistance = (ms: number) => {
  let remaining = Math.max(0, ms);
  const parts: string[] = [];
  for (const [label, size] of UNITS) {
    const value = Math.floor(remaining / size);
    remaining -= value * size;
    if (value > 0 || parts.length) parts.push(`${value}${label}`);
    if (parts.length === 2) break;
  }
  return parts.length ? parts.join(" ") : "0s";
};

/** Local wall-clock rendering of a stored instant, e.g. "25 Aug 2026, 14:30". */
export const formatMoment = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * <input type="datetime-local"> speaks local wall-clock time with no zone, so both directions
 * are converted explicitly - anything implicit here is how a quiz ends up opening an hour out.
 */
export const isoToLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

export const localInputToIso = (value: string) => {
  if (!value) return null;
  const date = new Date(value); // parsed in the browser's zone, which is what was typed
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
