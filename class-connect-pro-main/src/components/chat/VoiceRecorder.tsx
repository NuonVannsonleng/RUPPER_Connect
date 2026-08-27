import { useEffect, useRef, useState } from "react";
import { Mic, SendHorizonal, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/messageAttachments";

/** Long enough for a real note, short enough to stay under the 5MB the server accepts. */
const MAX_MS = 3 * 60 * 1000;

/** The first of these the browser supports wins - Safari has no WebM encoder. */
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", "audio/aac"];

const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined") return null;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const extensionFor = (mimeType: string) => {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("aac")) return "m4a";
  return "webm";
};

interface VoiceRecorderProps {
  /** Called with the finished clip and how long it ran. */
  onRecorded: (file: File, durationMs: number) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecorded, disabled }: VoiceRecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  // Set when the user hits the bin, so the stop handler knows to throw the clip away.
  const cancelledRef = useRef(false);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const cleanUp = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsed(0);
  };

  // Releasing the microphone matters as much as releasing a camera: leave it running and the
  // browser keeps showing the recording indicator after the page has moved on.
  useEffect(() => () => cleanUp(), []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("This browser can't record audio. Try Chrome, or attach an audio file instead.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      toast.error(
        name === "NotAllowedError"
          ? "Microphone permission was refused. Allow it for this site to record a voice message."
          : "No microphone the browser can use."
      );
      return;
    }

    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];
    cancelledRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current;
      const type = recorder.mimeType || mimeType || "audio/webm";
      const chunks = chunksRef.current;
      const cancelled = cancelledRef.current;
      cleanUp();

      if (cancelled) return;
      // Guard against a tap that registers as a recording: anything under a second is noise.
      if (durationMs < 800) {
        toast.error("That was too short. Hold the button while you speak.");
        return;
      }

      const blob = new Blob(chunks, { type });
      const file = new File([blob], `voice-${Date.now()}.${extensionFor(type)}`, { type });
      onRecorded(file, durationMs);
    };

    startedAtRef.current = Date.now();
    recorder.start();
    setRecording(true);
    setElapsed(0);

    tickRef.current = window.setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      // Stop at the ceiling rather than letting a forgotten recording fail on upload.
      if (ms >= MAX_MS) recorderRef.current?.stop();
    }, 200);
  };

  const stopAndSend = () => recorderRef.current?.stop();

  const cancel = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  };

  if (!recording) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => void start()}
        disabled={disabled}
        aria-label="Record a voice message"
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5">
      <span className="flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />
      <span className="text-sm font-semibold tabular-nums text-foreground">{formatDuration(elapsed)}</span>
      <span className="truncate text-xs text-muted-foreground">Recording...</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={cancel}
        aria-label="Discard recording"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full bg-gradient-primary p-0 text-primary-foreground"
        onClick={stopAndSend}
        aria-label="Stop and send"
      >
        {elapsed >= MAX_MS ? <Square className="h-3.5 w-3.5" /> : <SendHorizonal className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
