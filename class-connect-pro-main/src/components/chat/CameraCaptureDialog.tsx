import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, RefreshCw, SwitchCamera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CameraState = "starting" | "ready" | "denied" | "unavailable" | "error";

const MESSAGES: Record<Exclude<CameraState, "starting" | "ready">, string> = {
  denied: "Camera permission was refused. Allow it for this site, or attach a photo from your files instead.",
  unavailable:
    "No camera the browser can use. On a phone, make sure the page is open over https - cameras are blocked on insecure connections.",
  error: "The camera could not be started. Something else may be using it.",
};

interface CameraCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  /** Handed a JPEG of the frame that was captured. */
  onCapture: (file: File) => void;
}

export function CameraCaptureDialog({ open, onClose, onCapture }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<CameraState>("starting");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);

  /** Releases the camera. Without this the phone's camera light stays on after closing. */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setState("starting");
    setPreview(null);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setState("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true"); // iOS Safari full-screens the video otherwise
        await video.play();
        if (!cancelled) setState("ready");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") setState("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setState("unavailable");
        else setState("error");
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, facing, stopCamera]);

  // The preview holds an object URL; revoke it when it is replaced or the dialog closes.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    // JPEG at 0.85: a raw PNG of a camera frame runs to several megabytes and would fail the
    // 5MB photo limit on a decent phone camera.
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPreview({ url: URL.createObjectURL(blob), file });
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  };

  const close = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>
            {preview ? "Send this one, or take another." : "Line up your shot and press the button."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
          {preview ? (
            <img src={preview.url} alt="" className="h-full w-full object-contain" />
          ) : (
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          )}

          {state === "starting" && !preview && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera...
            </div>
          )}

          {state !== "starting" && state !== "ready" && !preview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
              <CameraOff className="h-9 w-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{MESSAGES[state]}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {preview ? (
            <>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button
                className="bg-gradient-primary text-primary-foreground"
                onClick={() => {
                  onCapture(preview.file);
                  close();
                }}
              >
                Send photo
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setFacing((current) => (current === "user" ? "environment" : "user"))}
                disabled={state !== "ready"}
                aria-label="Switch camera"
              >
                <SwitchCamera className="h-5 w-5" />
              </Button>
              <Button
                onClick={capture}
                disabled={state !== "ready"}
                className="h-12 w-12 rounded-full bg-gradient-primary p-0 text-primary-foreground"
                aria-label="Take photo"
              >
                <Camera className="h-5 w-5" />
              </Button>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
