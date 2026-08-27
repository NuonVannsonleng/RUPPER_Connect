import { describe, it, expect } from "vitest";

import { buildAttendanceLink, parseAttendanceCode } from "@/lib/attendanceCode";

/**
 * Whatever this returns gets POSTed as a check-in, and it runs on data that came out of a
 * camera pointed at an arbitrary QR code - so "returns null" matters as much as the happy path.
 */
describe("parseAttendanceCode", () => {
  it("reads a bare code", () => {
    expect(parseAttendanceCode("RUPPER-734835-5401")).toBe("RUPPER-734835-5401");
  });

  it("normalises case and surrounding whitespace", () => {
    expect(parseAttendanceCode("  rupper-734835-5401 \n")).toBe("RUPPER-734835-5401");
  });

  it("reads the code out of a scanned check-in link", () => {
    expect(parseAttendanceCode("https://class-connect-pro-rupp.vercel.app/attendance?code=RUPPER-734835-5401")).toBe(
      "RUPPER-734835-5401"
    );
  });

  it("reads it from a link carrying other parameters too", () => {
    expect(parseAttendanceCode("https://example.com/attendance?from=qr&code=RUPPER-111111-2222&x=1")).toBe(
      "RUPPER-111111-2222"
    );
  });

  it("handles a percent-encoded parameter", () => {
    expect(parseAttendanceCode("https://example.com/attendance?code=RUPPER%2D734835%2D5401")).toBe(
      "RUPPER-734835-5401"
    );
  });

  it("prefers the code parameter over one appearing elsewhere in the URL", () => {
    expect(parseAttendanceCode("https://example.com/RUPPER-999999-9999?code=RUPPER-111111-1111")).toBe(
      "RUPPER-111111-1111"
    );
  });

  it("returns null for a QR code that has nothing to do with attendance", () => {
    for (const junk of ["https://youtube.com/watch?v=abc", "WIFI:S=campus;T=WPA;P=hunter2;;", "hello world", ""]) {
      expect(parseAttendanceCode(junk)).toBeNull();
    }
  });

  it("returns null rather than throwing on empty input", () => {
    expect(parseAttendanceCode(null)).toBeNull();
    expect(parseAttendanceCode(undefined)).toBeNull();
  });

  it("does not accept a code-shaped string with the wrong prefix", () => {
    expect(parseAttendanceCode("SCHOOL-734835-5401")).toBeNull();
  });
});

describe("buildAttendanceLink", () => {
  it("builds a link the parser can read back", () => {
    const link = buildAttendanceLink("https://class-connect-pro-rupp.vercel.app", "RUPPER-734835-5401");
    expect(link).toBe("https://class-connect-pro-rupp.vercel.app/attendance?code=RUPPER-734835-5401");
    expect(parseAttendanceCode(link)).toBe("RUPPER-734835-5401");
  });

  it("does not double the slash when the origin has a trailing one", () => {
    expect(buildAttendanceLink("http://localhost:8080/", "RUPPER-1234-567")).toBe(
      "http://localhost:8080/attendance?code=RUPPER-1234-567"
    );
  });
});
