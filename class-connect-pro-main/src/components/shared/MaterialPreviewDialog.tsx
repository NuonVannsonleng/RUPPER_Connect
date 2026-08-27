import { FilePreviewDialog, getFileExtension, previewKindFor } from "@/components/shared/FilePreviewDialog";
import type { AcademicMaterial } from "@/data/academicPlatform";

export { getFileExtension };

/**
 * PDFs, images and video render natively in the browser, Word docs are converted client-side
 * with docx-preview, and text-shaped files (txt, csv, json, ...) are shown as text. Excel and
 * PowerPoint have no safe client-side renderer available - the npm build of SheetJS carries
 * unpatched CVEs - so those stay download-only.
 */
export const isPreviewable = (material: AcademicMaterial) =>
  Boolean(material.downloadUrl) && previewKindFor(material.fileName) !== "unsupported";

interface MaterialPreviewDialogProps {
  material: AcademicMaterial | null;
  onClose: () => void;
}

export function MaterialPreviewDialog({ material, onClose }: MaterialPreviewDialogProps) {
  return (
    <FilePreviewDialog
      file={material ? { title: material.title, fileName: material.fileName, downloadUrl: material.downloadUrl } : null}
      onClose={onClose}
    />
  );
}
