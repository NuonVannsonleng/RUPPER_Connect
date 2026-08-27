import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { Download, FileQuestion, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildApiUrl, getToken } from "@/lib/api";
import {
  getFileExtension,
  previewKindFor,
  previewMimeFor,
  UNSUPPORTED_REASON,
} from "@/lib/filePreview";

export { getFileExtension, previewKindFor } from "@/lib/filePreview";
export type { PreviewKind } from "@/lib/filePreview";

/** Anything with a name and a download URL can be previewed - a material, a submission, ... */
export interface PreviewFile {
  title: string;
  fileName?: string;
  downloadUrl?: string;
  /** Optional line under the title, e.g. the student who submitted it. */
  subtitle?: string;
}

/** Past this, a text file is truncated rather than locking the tab up rendering it. */
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

async function fetchFileBlob(downloadUrl: string) {
  const res = await fetch(buildApiUrl(downloadUrl), {
    headers: { Authorization: `Bearer ${getToken() || ""}` },
  });
  if (!res.ok) throw new Error("Could not load file");
  return res.blob();
}

/** Retypes a fetched blob from its extension before createObjectURL sees it - see previewMimeFor. */
const asPreviewBlob = (blob: Blob, extension: string) => new Blob([blob], { type: previewMimeFor(extension) });

interface FilePreviewDialogProps {
  file: PreviewFile | null;
  onClose: () => void;
}

export function FilePreviewDialog({ file, onClose }: FilePreviewDialogProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  const extension = getFileExtension(file?.fileName);
  const kind = previewKindFor(file?.fileName);

  useEffect(() => {
    if (!file?.downloadUrl) return;

    let cancelled = false;
    let createdUrl: string | null = null;

    setStatus(kind === "unsupported" ? "ready" : "loading");
    setObjectUrl(null);
    setText(null);
    setTruncated(false);

    // Nothing to fetch - the footer's Download button is the whole interaction.
    if (kind === "unsupported") return;

    fetchFileBlob(file.downloadUrl)
      .then(async (blob) => {
        if (cancelled) return;

        if (kind === "docx") {
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = "";
            await renderAsync(blob, docxContainerRef.current);
          }
        } else if (kind === "text") {
          const slice = blob.size > MAX_TEXT_BYTES ? blob.slice(0, MAX_TEXT_BYTES) : blob;
          const content = await slice.text();
          if (cancelled) return;
          setText(content);
          setTruncated(blob.size > MAX_TEXT_BYTES);
        } else {
          createdUrl = URL.createObjectURL(asPreviewBlob(blob, extension));
          if (!cancelled) setObjectUrl(createdUrl);
        }

        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kind/extension derive from file
  }, [file]);

  const handleDownload = async () => {
    if (!file?.downloadUrl) return;
    try {
      const blob = await fetchFileBlob(file.downloadUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName || file.title;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download this file");
    }
  };

  const unsupportedLabel = UNSUPPORTED_REASON[extension] || `.${extension || "This"} files`;

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && onClose()}>
      {/* Fills the browser viewport rather than the usual centered card - a comfortable reading
          size for a full document, but still just a page element (no OS-level Fullscreen API). */}
      <DialogContent className="left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-none">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0 pr-8 text-left">
            <DialogTitle className="truncate">{file?.title}</DialogTitle>
            {file?.subtitle && <p className="truncate text-xs text-muted-foreground">{file.subtitle}</p>}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-secondary/30">
          {status === "loading" && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading preview...
            </div>
          )}

          {status === "error" && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Could not load a preview for this file.
            </div>
          )}

          {status === "ready" && kind === "unsupported" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <FileQuestion className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{unsupportedLabel} can't be shown in the browser</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Download {file?.fileName ? <span className="font-medium">{file.fileName}</span> : "the file"} to open it
                in the app it belongs to.
              </p>
              <Button onClick={handleDownload} className="mt-2 bg-gradient-primary text-primary-foreground">
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>
          )}

          {status === "ready" && kind === "pdf" && objectUrl && (
            <iframe src={objectUrl} title={file?.title} className="h-full w-full" />
          )}

          {status === "ready" && kind === "image" && objectUrl && (
            <img src={objectUrl} alt={file?.title} className="mx-auto h-full max-w-full object-contain" />
          )}

          {status === "ready" && kind === "video" && objectUrl && (
            <video src={objectUrl} controls className="mx-auto h-full max-w-full" />
          )}

          {status === "ready" && kind === "text" && text !== null && (
            <div className="mx-auto max-w-5xl p-6">
              {truncated && (
                <p className="mb-3 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  Showing the first 2 MB of this file. Download it to read the rest.
                </p>
              )}
              {/* Text content, never markup: this is the one safe way to show a submitted
                  .html or .js file. React escapes it, and nothing here is interpreted. */}
              <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed text-foreground">
                {text}
              </pre>
            </div>
          )}

          <div
            ref={docxContainerRef}
            className={kind === "docx" && status === "ready" ? "docx-preview-container mx-auto max-w-3xl bg-white p-8" : "hidden"}
          />
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownload} className="bg-gradient-primary text-primary-foreground">
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
