/**
 * Attendance codes travel two ways: typed in by hand, or read out of a QR code.
 *
 * The QR encodes a link rather than the bare code, so a student can point their phone's normal
 * camera app at the projector and land straight on the check-in screen - no need to open this
 * app first and find the scanner. The in-app scanner then has to cope with either form, plus
 * whatever a student might paste, which is what parseAttendanceCode is for.
 */

/** Matches the codes the backend mints: RUPPER-<6 digits>-<4 digits>. */
const CODE_PATTERN = /RUPPER-\d{4,8}-\d{3,6}/i;

/** Where a scanned link should land. Kept here so the QR and the router agree. */
export const ATTENDANCE_PATH = "/attendance";

/** The query parameter a scanned link carries the code in. */
export const ATTENDANCE_CODE_PARAM = "code";

/**
 * Pulls an attendance code out of whatever was scanned, typed, or pasted.
 *
 * Accepts the bare code, a full check-in link, or a link with other parameters on it, and
 * returns null for anything that doesn't contain a code - a student scanning some unrelated
 * QR code on a poster should get "that isn't an attendance code", not a failed API call.
 */
export function parseAttendanceCode(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  // A link: prefer the query parameter, so a code appearing elsewhere in the URL can't win.
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const param = url.searchParams.get(ATTENDANCE_CODE_PARAM);
      const fromParam = param && CODE_PATTERN.exec(param);
      if (fromParam) return fromParam[0].toUpperCase();
    } catch {
      // Malformed URL - fall through and scan the raw text instead.
    }
  }

  const match = CODE_PATTERN.exec(text);
  return match ? match[0].toUpperCase() : null;
}

/**
 * The URL encoded into the teacher's QR code. Built from the running origin rather than a
 * baked-in domain so it is correct on localhost, on a preview deployment, and in production.
 */
export function buildAttendanceLink(origin: string, code: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${ATTENDANCE_PATH}?${ATTENDANCE_CODE_PARAM}=${encodeURIComponent(code)}`;
}
