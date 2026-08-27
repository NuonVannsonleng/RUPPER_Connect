import { describe, it, expect } from "vitest";

import { previewKindFor, previewMimeFor, getFileExtension } from "@/lib/filePreview";

/**
 * The submission viewer decides what to do with a file purely from its name, and one of those
 * branches is a security boundary: "text" is rendered into a <pre>, everything else can end up
 * in an iframe or an <img> via a blob: URL that runs in this app's origin. Assignment uploads
 * accept .html, .js and .php, so if any of those ever stopped being classed as text a student
 * could execute markup in the reviewing teacher's session.
 */
describe("preview classification", () => {
  it("renders documents and media natively", () => {
    expect(previewKindFor("report.pdf")).toBe("pdf");
    expect(previewKindFor("diagram.png")).toBe("image");
    expect(previewKindFor("photo.JPEG")).toBe("image");
    expect(previewKindFor("demo.mp4")).toBe("video");
    expect(previewKindFor("essay.docx")).toBe("docx");
  });

  it("classes every executable or markup upload as text, never as something renderable", () => {
    for (const name of ["index.html", "page.htm", "app.js", "main.php", "style.css", "script.sh", "run.bat"]) {
      expect(previewKindFor(name)).toBe("text");
    }
  });

  it("shows source code and data files as text", () => {
    for (const name of ["solution.py", "Main.java", "notes.txt", "grades.csv", "data.json", "query.sql"]) {
      expect(previewKindFor(name)).toBe("text");
    }
  });

  it("leaves formats with no safe renderer to download", () => {
    for (const name of ["book.xlsx", "deck.pptx", "bundle.zip", "archive.7z", "thing.unknown"]) {
      expect(previewKindFor(name)).toBe("unsupported");
    }
  });

  it("treats a missing or extensionless name as unsupported rather than guessing", () => {
    expect(previewKindFor(undefined)).toBe("unsupported");
    expect(previewKindFor("")).toBe("unsupported");
  });

  it("is not fooled by a double extension - the last one wins", () => {
    expect(getFileExtension("report.pdf.html")).toBe("html");
    expect(previewKindFor("report.pdf.html")).toBe("text");
    expect(previewKindFor("safe.html.pdf")).toBe("pdf");
  });
});

describe("preview blob typing", () => {
  it("only ever assigns a renderable type to formats that are safe to render", () => {
    expect(previewMimeFor("pdf")).toBe("application/pdf");
    expect(previewMimeFor("png")).toBe("image/png");
    expect(previewMimeFor("mp4")).toBe("video/mp4");
  });

  it("never types markup or script as something a browser will execute", () => {
    for (const ext of ["html", "htm", "js", "php", "svg", "xml"]) {
      expect(previewMimeFor(ext)).toBe("application/octet-stream");
    }
  });
});
