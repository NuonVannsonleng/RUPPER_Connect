import { describe, it, expect } from "vitest";

import {
  ATTACHMENT_RULES,
  extensionOf,
  formatBytes,
  formatDuration,
  validateAttachment,
} from "@/lib/messageAttachments";

/**
 * These mirror ATTACHMENT_RULES in the backend controller. The server is what actually
 * enforces them; this check exists so a 9MB photo is refused before it spends thirty seconds
 * uploading. If the two ever drift, the server wins and the user gets a worse error.
 */
describe("attachment validation", () => {
  const file = (name: string, size = 1024) => ({ name, size });

  it("accepts the image formats a phone produces", () => {
    for (const name of ["photo.png", "photo.JPG", "shot.jpeg", "anim.gif", "pic.webp"]) {
      expect(validateAttachment("image", file(name))).toBeNull();
    }
  });

  it("refuses a document sent through the photo picker", () => {
    expect(validateAttachment("image", file("essay.pdf"))).toMatch(/isn't an image/i);
  });

  it("refuses an executable sent as a file", () => {
    for (const name of ["virus.exe", "script.sh", "run.bat", "lib.dll"]) {
      expect(validateAttachment("file", file(name))).toMatch(/can't be sent/i);
    }
  });

  it("refuses anything with no extension at all", () => {
    expect(validateAttachment("file", file("README"))).toMatch(/can't be sent/i);
  });

  it("refuses an empty file", () => {
    expect(validateAttachment("image", file("photo.png", 0))).toMatch(/empty/i);
  });

  it("enforces each kind's size ceiling", () => {
    expect(validateAttachment("image", file("big.png", ATTACHMENT_RULES.image.maxBytes + 1))).toMatch(/5MB/);
    expect(validateAttachment("file", file("big.zip", ATTACHMENT_RULES.file.maxBytes + 1))).toMatch(/10MB/);
    expect(validateAttachment("voice", file("long.webm", ATTACHMENT_RULES.voice.maxBytes + 1))).toMatch(/5MB/);
  });

  it("allows a file exactly on the limit", () => {
    expect(validateAttachment("image", file("edge.png", ATTACHMENT_RULES.image.maxBytes))).toBeNull();
  });

  it("accepts the audio formats a browser records", () => {
    for (const name of ["voice.webm", "voice.ogg", "voice.m4a", "clip.mp3", "clip.wav"]) {
      expect(validateAttachment("voice", file(name))).toBeNull();
    }
  });
});

describe("extensionOf", () => {
  it("takes the last extension, so a double one can't disguise the type", () => {
    expect(extensionOf("photo.png")).toBe("png");
    expect(extensionOf("report.pdf.exe")).toBe("exe");
    expect(extensionOf("SHOUTING.PNG")).toBe("png");
  });
});

describe("formatting", () => {
  it("renders a voice note's length as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(7_000)).toBe("0:07");
    expect(formatDuration(64_000)).toBe("1:04");
    expect(formatDuration(750_000)).toBe("12:30");
  });

  it("does not render junk for a bad duration", () => {
    expect(formatDuration(Number.NaN)).toBe("0:00");
    expect(formatDuration(-5)).toBe("0:00");
  });

  it("scales file sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(undefined)).toBe("");
  });
});
