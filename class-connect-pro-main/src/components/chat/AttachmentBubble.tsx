import { useEffect, useState } from "react";
import { Download, FileText, ImageOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildApiUrl, getToken } from "@/lib/api";
import { formatBytes, formatDuration } from "@/lib/messageAttachments";

export interface MessageAttachment {
  kind: "image" | "file" | "voice" | "sticker";
  fileName?: string;
  fileSize?: number;
  durationMs?: number;
  url?: string;
}

/**
 * Attachments sit behind the API's bearer auth, so `<img src>` and `<audio src>` can't load
 * them directly - the browser sends no Authorization header. Each one is fetched as a blob
 * and handed to the element as an object URL instead.
 */
function useAuthedBlobUrl(url: string | undefined, enabled: boolean) {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });

  useEffect(() => {
    if (!url || !enabled) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ url: null, failed: false });

    fetch(buildApiUrl(url), { headers: { Authorization: `Bearer ${getToken() || ""}` } })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load attachment");
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, failed: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, enabled]);

  return state;
}

async function downloadAttachment(url: string, fileName: string) {
  try {
    const response = await fetch(buildApiUrl(url), { headers: { Authorization: `Bearer ${getToken() || ""}` } });
    if (!response.ok) throw new Error("Download failed");
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    toast.error("Could not download that file");
  }
}

interface AttachmentBubbleProps {
  attachment: MessageAttachment;
  fromMe: boolean;
  onOpenImage: (url: string, fileName?: string) => void;
}

export function AttachmentBubble({ attachment, fromMe, onOpenImage }: AttachmentBubbleProps) {
  const needsBlob = attachment.kind === "image" || attachment.kind === "voice";
  const { url: blobUrl, failed } = useAuthedBlobUrl(attachment.url, needsBlob);

  if (attachment.kind === "image") {
    if (failed) {
      return (
        <span className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <ImageOff className="h-4 w-4" /> Image unavailable
        </span>
      );
    }
    if (!blobUrl) {
      return (
        <span className="flex h-40 w-48 items-center justify-center rounded-lg bg-black/20">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onOpenImage(blobUrl, attachment.fileName)}
        className="block overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open photo"
      >
        <img src={blobUrl} alt={attachment.fileName || "Photo"} className="max-h-64 w-auto max-w-full object-cover" />
      </button>
    );
  }

  if (attachment.kind === "voice") {
    return (
      <span className="flex min-w-[13rem] flex-col gap-1">
        {failed ? (
          <span className="text-xs text-muted-foreground">Voice message unavailable</span>
        ) : blobUrl ? (
          // Native controls: a hand-built scrubber would be a lot of surface for no gain, and
          // this already behaves correctly on mobile.
          <audio src={blobUrl} controls preload="metadata" className="h-9 w-full" />
        ) : (
          <span className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading audio...
          </span>
        )}
        {attachment.durationMs ? (
          <span className={`text-[10px] tabular-nums ${fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {formatDuration(attachment.durationMs)}
          </span>
        ) : null}
      </span>
    );
  }

  // A file: name, size, and a download. There is no safe way to render an arbitrary
  // attachment inline, and the assignment viewer already covers reading documents.
  return (
    <span className="flex min-w-[13rem] items-center gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          fromMe ? "bg-primary-foreground/15" : "bg-secondary"
        }`}
      >
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{attachment.fileName || "Attachment"}</span>
        <span className={`block text-[10px] ${fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatBytes(attachment.fileSize)}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-8 w-8 shrink-0 ${fromMe ? "text-primary-foreground hover:bg-primary-foreground/15" : ""}`}
        onClick={() => attachment.url && downloadAttachment(attachment.url, attachment.fileName || "attachment")}
        aria-label={`Download ${attachment.fileName || "attachment"}`}
      >
        <Download className="h-4 w-4" />
      </Button>
    </span>
  );
}
