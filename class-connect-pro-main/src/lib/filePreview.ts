/**
 * How a downloaded file should be shown, decided purely from its name.
 *
 * Kept apart from the dialog so it can be tested directly: the split between "text" and
 * everything else is a security boundary, not a cosmetic choice (see TEXT_EXTENSIONS).
 */

export const getFileExtension = (fileName?: string) => fileName?.split(".").pop()?.toLowerCase() || "";

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
export const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);
export const DOCX_EXTENSIONS = new Set(["doc", "docx"]);

/**
 * Read as text and shown in a <pre>, never handed to an iframe.
 *
 * That distinction is the whole security story for this list. Assignment submissions accept
 * .html, .js and .php, and a `blob:` URL runs in this app's own origin - so putting a
 * submitted .html file in an iframe would execute a student's markup with access to the
 * reviewing teacher's session token. Rendering the bytes as text is safe for every entry
 * here precisely because nothing in it is ever interpreted.
 *
 * Never move a markup or script extension out of this set.
 */
export const TEXT_EXTENSIONS = new Set([
  "txt", "csv", "json", "md", "log", "xml", "yml", "yaml", "sql", "ini", "env",
  "py", "js", "jsx", "ts", "tsx", "java", "c", "cpp", "cc", "h", "hpp", "cs",
  "rb", "go", "php", "html", "htm", "css", "scss", "sh", "bat",
]);

export type PreviewKind = "pdf" | "image" | "video" | "docx" | "text" | "unsupported";

export const previewKindFor = (fileName?: string): PreviewKind => {
  const ext = getFileExtension(fileName);
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (DOCX_EXTENSIONS.has(ext)) return "docx";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  return "unsupported";
};

/** Spreadsheets, slide decks and archives have no renderer here - they download instead. */
export const UNSUPPORTED_REASON: Record<string, string> = {
  xls: "Excel workbooks",
  xlsx: "Excel workbooks",
  ppt: "PowerPoint decks",
  pptx: "PowerPoint decks",
  zip: "Archives",
  rar: "Archives",
  "7z": "Archives",
};

/**
 * The type on a preview blob is set from the extension, never from the server response.
 *
 * A `blob:` URL runs in this app's origin, so an object URL that ended up typed `text/html`
 * would execute its contents with access to the signed-in user's session the moment it was
 * put in an iframe. The backend pins the stored type to the extension too; this is the second
 * half of that, so a bad Content-Type can never reach createObjectURL. Only types that are
 * safe to render appear here - anything else falls through to a download.
 */
export const PREVIEW_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
};

export const previewMimeFor = (extension: string) => PREVIEW_MIME[extension] || "application/octet-stream";
