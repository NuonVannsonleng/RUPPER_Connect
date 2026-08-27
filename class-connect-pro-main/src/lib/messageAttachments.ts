/**
 * Client-side rules for chat attachments.
 *
 * These mirror ATTACHMENT_RULES in rupper-backend/controllers/academicController.js, and the
 * server is the one that actually enforces them - this exists so a 9MB photo is refused
 * before it spends thirty seconds uploading, not to be trusted. Keep the two in step.
 */

export type AttachmentKind = "image" | "file" | "voice" | "sticker";

export const ATTACHMENT_RULES: Record<"image" | "file" | "voice", { extensions: string[]; maxBytes: number }> = {
  image: { extensions: ["png", "jpg", "jpeg", "gif", "webp"], maxBytes: 5 * 1024 * 1024 },
  voice: { extensions: ["webm", "ogg", "oga", "m4a", "mp3", "wav"], maxBytes: 5 * 1024 * 1024 },
  file: {
    extensions: [
      "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv",
      "zip", "rar", "7z", "png", "jpg", "jpeg", "gif", "webp",
    ],
    maxBytes: 10 * 1024 * 1024,
  },
};

/** The `accept` attribute for each picker, so the file dialog offers the right things first. */
export const ACCEPT_ATTRIBUTE: Record<"image" | "file", string> = {
  image: "image/png,image/jpeg,image/gif,image/webp",
  file: ATTACHMENT_RULES.file.extensions.map((extension) => `.${extension}`).join(","),
};

export const extensionOf = (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? "";

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** Returns a message explaining why this can't be sent, or null when it can. */
export function validateAttachment(kind: "image" | "file" | "voice", file: { name: string; size: number }): string | null {
  const rules = ATTACHMENT_RULES[kind];
  const extension = extensionOf(file.name);

  if (!extension || !rules.extensions.includes(extension)) {
    return kind === "image"
      ? "That isn't an image. Choose a PNG, JPG, GIF, or WebP."
      : `That file type can't be sent. Allowed: ${rules.extensions.join(", ")}.`;
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > rules.maxBytes) {
    return `Too large. The limit for ${kind === "image" ? "photos" : `${kind}s`} is ${megabytes(rules.maxBytes)}MB.`;
  }
  return null;
}

/** Reads a file into the base64 the API expects, without the `data:...;base64,` prefix. */
export const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });

/** `0:07`, `1:04`, `12:30` - the length shown on a voice note. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Emoji for the composer's picker, grouped the way people look for them. */
export const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Smileys",
    emoji: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","😘","😋","😜","🤪","🤗","🤔","🤨","😐","😴","😪","😌","😔","😢","😭","😤","😡","🥵","🥶","😳","🤯","😱","😬","🙄","😮","🤐"],
  },
  {
    label: "Gestures",
    emoji: ["👍","👎","👌","✌️","🤞","🤟","🤙","👈","👉","👆","👇","👏","🙌","🤝","🙏","💪","✍️","👋","🫡","🤲"],
  },
  {
    label: "Study",
    emoji: ["📚","📖","📝","✏️","📐","📊","📈","📅","⏰","💡","🔍","🎓","🏫","🧪","💻","🖥️","📎","📌","✅","❌","❓","❗","⭐","🔥","🎯","🏆","📢","🔔"],
  },
  {
    label: "Life",
    emoji: ["❤️","🧡","💛","💚","💙","💜","🎉","🎊","🎁","☕","🍜","🍚","🍕","⚽","🏀","🎵","🌧️","☀️","🌙","🌸"],
  },
];

/** Bigger, standalone graphics sent on their own rather than typed into a sentence. */
export const STICKERS: string[] = [
  "🎉","👍","🔥","💯","🙏","👏","❤️","😂","😍","🤔",
  "😭","😱","🥳","🤝","💪","🎓","📚","✅","⭐","🚀",
];
