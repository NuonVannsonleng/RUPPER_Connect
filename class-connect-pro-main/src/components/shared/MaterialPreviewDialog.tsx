import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildApiUrl, getToken } from "@/lib/api";
import type { AcademicMaterial } from "@/data/academicPlatform";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);
const DOCX_EXTENSIONS = new Set(["doc", "docx"]);

export const getFileExtension = (fileName?: string) => fileName?.split(".").pop()?.toLowerCase() || "";

/**
 * PDFs, images, and video render natively in the browser. Word docs are converted client-side
 * with docx-preview. Excel and PowerPoint have no safe client-side renderer available - the
 * npm build of SheetJS carries unpatched CVEs - so those stay download-only for now.
 */
export const isPreviewable = (material: AcademicMaterial) => {
  const ext = getFileExtension(material.fileName);
  return Boolean(material.downloadUrl) && (ext === "pdf" || IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext) || DOCX_EXTENSIONS.has(ext));
};

async function fetchMaterialBlob(downloadUrl: string) {
  const res = await fetch(buildApiUrl(downloadUrl), {
    headers: { Authorization: `Bearer ${getToken() || ""}` },
  });
  if (!res.ok) throw new Error("Could not load file");
  return res.blob();
}

interface MaterialPreviewDialogProps {
  material: AcademicMaterial | null;
  onClose: () => void;
}

export function MaterialPreviewDialog({ material, onClose }: MaterialPreviewDialogProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const extension = getFileExtension(material?.fileName);
  const isDocx = DOCX_EXTENSIONS.has(extension);

  useEffect(() => {
    if (!material?.downloadUrl) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setStatus("loading");
    setObjectUrl(null);

    fetchMaterialBlob(material.downloadUrl)
      .then(async (blob) => {
        if (cancelled) return;
        if (isDocx) {
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = "";
            await renderAsync(blob, docxContainerRef.current);
          }
        } else {
          createdUrl = URL.createObjectURL(blob);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isDocx is derived from material, re-running on material change is enough
  }, [material]);

  const handleDownload = async () => {
    if (!material?.downloadUrl) return;
    try {
      const blob = await fetchMaterialBlob(material.downloadUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = material.fileName || material.title;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download this file");
    }
  };

  return (
    <Dialog open={Boolean(material)} onOpenChange={(open) => !open && onClose()}>
      {/* Fills the browser viewport rather than the usual centered card - a comfortable reading
          size for a full document, but still just a page element (no OS-level Fullscreen API). */}
      <DialogContent className="left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-none">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <DialogTitle className="truncate pr-8">{material?.title}</DialogTitle>
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
          {status === "ready" && extension === "pdf" && objectUrl && (
            <iframe src={objectUrl} title={material?.title} className="h-full w-full" />
          )}
          {status === "ready" && IMAGE_EXTENSIONS.has(extension) && objectUrl && (
            <img src={objectUrl} alt={material?.title} className="mx-auto h-full max-w-full object-contain" />
          )}
          {status === "ready" && VIDEO_EXTENSIONS.has(extension) && objectUrl && (
            <video src={objectUrl} controls className="mx-auto h-full max-w-full" />
          )}
          <div ref={docxContainerRef} className={isDocx && status === "ready" ? "docx-preview-container mx-auto max-w-3xl bg-white p-8" : "hidden"} />
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
