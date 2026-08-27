import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";

import { buildAttendanceLink, parseAttendanceCode } from "@/lib/attendanceCode";

/**
 * The QR a teacher projects is the only part of check-in nobody can proofread by eye, so this
 * renders it exactly as the attendance page does, rasterises it, and reads it back with the
 * same decoder the student's scanner uses. A change to the payload, the error-correction
 * level, or the quiet zone that made it unreadable would fail here rather than in a classroom.
 */

const MODULE_PIXELS = 6;
/** The QR spec's minimum silent border; a code rendered flush to its edge often won't scan. */
const QUIET_MODULES = 4;

/** Renders the QR the way the page does, and turns the SVG back into a module grid. */
function renderModules(value: string) {
  const svg = renderToStaticMarkup(
    createElement(QRCodeSVG, { value, size: 200, level: "M", marginSize: 0 })
  );

  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)![1]);
  const darkPath = /<path fill="#000000" d="([^"]+)"/.exec(svg)![1];

  const grid = Array.from({ length: size }, () => new Uint8Array(size));
  // qrcode.react emits each row as horizontal runs: M<x> <y>h<width>v1H<x>z
  for (const run of darkPath.matchAll(/M(\d+)[ ,](\d+)\s*h(\d+)v1H\d+z/g)) {
    const x = Number(run[1]);
    const y = Number(run[2]);
    const width = Number(run[3]);
    for (let i = 0; i < width; i += 1) grid[y][x + i] = 1;
  }

  return { grid, size };
}

/** Paints the grid into RGBA pixels, black on white, with a quiet zone around it. */
function rasterize(grid: Uint8Array[], size: number) {
  const dimension = (size + QUIET_MODULES * 2) * MODULE_PIXELS;
  const data = new Uint8ClampedArray(dimension * dimension * 4).fill(255);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!grid[y][x]) continue;
      for (let dy = 0; dy < MODULE_PIXELS; dy += 1) {
        for (let dx = 0; dx < MODULE_PIXELS; dx += 1) {
          const row = (y + QUIET_MODULES) * MODULE_PIXELS + dy;
          const col = (x + QUIET_MODULES) * MODULE_PIXELS + dx;
          const offset = (row * dimension + col) * 4;
          data[offset] = data[offset + 1] = data[offset + 2] = 0;
        }
      }
    }
  }

  return { data, dimension };
}

const scan = (value: string) => {
  const { grid, size } = renderModules(value);
  const { data, dimension } = rasterize(grid, size);
  return jsQR(data, dimension, dimension)?.data ?? null;
};

describe("the attendance QR code", () => {
  it("decodes back to the exact check-in link", () => {
    const link = buildAttendanceLink("https://class-connect-pro-rupp.vercel.app", "RUPPER-734835-5401");
    expect(scan(link)).toBe(link);
  });

  it("carries a code the check-in parser accepts", () => {
    const link = buildAttendanceLink("https://class-connect-pro-rupp.vercel.app", "RUPPER-734835-5401");
    expect(parseAttendanceCode(scan(link))).toBe("RUPPER-734835-5401");
  });

  it("is readable from a localhost origin too", () => {
    const link = buildAttendanceLink("http://localhost:8080", "RUPPER-111111-2222");
    expect(parseAttendanceCode(scan(link))).toBe("RUPPER-111111-2222");
  });

  it("actually draws a code rather than an empty grid", () => {
    const { grid, size } = renderModules(buildAttendanceLink("https://example.com", "RUPPER-734835-5401"));
    const dark = grid.reduce((total, row) => total + row.reduce((sum, cell) => sum + cell, 0), 0);
    expect(size).toBeGreaterThan(20);
    expect(dark).toBeGreaterThan(size * 4);
  });
});
