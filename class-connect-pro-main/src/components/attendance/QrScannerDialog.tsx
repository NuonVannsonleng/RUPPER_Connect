import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseAttendanceCode } from "@/lib/attendanceCode";

type ScannerState = "starting" | "scanning" | "denied" | "unavailable" | "error";

const MESSAGES: Record<Exclude<ScannerState, "starting" | "scanning">, { title: string; detail: string }> = {
  denied: {
    title: "Camera permission was refused",
    detail:
      "Allow camera access for this site in your browser settings, then try again. You can always type the code in instead.",
  },
  unavailable: {
    title: "No camera available",
    detail:
      "This device has no camera the browser can use. On a phone, make sure the page is open over https - cameras are blocked on insecure connections.",
  },
  error: {
    title: "The camera could not be started",
    detail: "Something else may be using it. Close other apps using the camera, then try again.",
  },
};

interface QrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called once, with a validated attendance code, as soon as one is decoded. */
  onScan: (code: string) => void;
}

export function QrScannerDialog({ open, onClose, onScan }: QrScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  // Decoding keeps running for a frame or two after a hit, so this stops the same code being
  // reported twice and firing two check-in requests.
  const doneRef = useRef(false);

  const [state, setState] = useState<ScannerState>("starting");
  const [hint, setHint] = useState<string | null>(null);

  /** Releases the camera. Missing this leaves the phone's camera light on after closing. */
  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    doneRef.current = false;
    setState("starting");
    setHint(null);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setState("unavailable");
        return;
      }

      let stream: MediaStream;
      try {
        // facingMode is a hint, not a guarantee - on a laptop there is only the front camera
        // and the constraint is simply ignored rather than failing.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") setState("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setState("unavailable");
        else setState("error");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.setAttribute("playsinline", "true"); // iOS Safari full-screens the video without this
      try {
        await video.play();
      } catch {
        if (!cancelled) setState("error");
        return;
      }

      if (cancelled) return;
      setState("scanning");

      // Loaded only once the scanner is actually opened - it is dead weight for everyone else.
      const { default: jsQR } = await import("jsqr");
      if (cancelled) return;

      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        setState("error");
        return;
      }

      let sawFrame = false;

      const tick = () => {
        if (cancelled || doneRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });

          if (result?.data) {
            const code = parseAttendanceCode(result.data);
            if (code) {
              doneRef.current = true;
              stopCamera();
              onScan(code);
              return;
            }
            // A QR code that isn't ours - say so rather than looking frozen.
            setHint("That QR code isn't an attendance code. Point the camera at the one your teacher is showing.");
          } else if (!sawFrame) {
            sawFrame = true;
            setHint(null);
          }
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, onScan, stopCamera]);

  const failure = state === "denied" || state === "unavailable" || state === "error" ? MESSAGES[state] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          stopCamera();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan attendance QR</DialogTitle>
          <DialogDescription>
            Point your camera at the code your teacher is showing. You'll be marked present automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />

          {state === "scanning" && (
            /* A viewfinder, so it is obvious where to aim. Purely decorative. */
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-3/5 w-3/5 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}

          {state === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera...
            </div>
          )}

          {failure && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
              <CameraOff className="h-9 w-9 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{failure.title}</p>
              <p className="text-sm text-muted-foreground">{failure.detail}</p>
            </div>
          )}
        </div>

        {hint && state === "scanning" && <p className="text-center text-xs text-warning">{hint}</p>}

        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
