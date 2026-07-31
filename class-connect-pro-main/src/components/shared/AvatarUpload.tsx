import { useRef, useState, type ChangeEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Loader2, ZoomIn } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cropAndResizeImage, type PixelCrop } from "@/lib/imageCrop";

// Matches the course-material upload limit used elsewhere in the app, for consistency.
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

interface AvatarUploadProps {
  /** Current avatar - a data URL from a previous crop, or an external URL (e.g. Google OAuth). */
  value: string;
  /** Called with the new cropped+compressed data URL once the user confirms a crop. */
  onChange: (dataUrl: string) => void;
  name: string;
}

/**
 * One shared avatar picker used by every role wherever a profile photo can be set - pick a
 * file, crop it to a circle with drag-to-reposition and a zoom slider, and hand back a small
 * fixed-size image instead of the raw upload. Built on react-easy-crop: it owns the
 * drag/zoom/touch interaction, we own the actual pixel output via canvas.
 */
export function AvatarUpload({ value, onChange, name }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const resetCropperState = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file again still fires a change event.
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error("Choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("That image is too large. Choose a file under 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resetCropperState();
      setPickedImage(String(reader.result));
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  };

  const handleSaveCrop = async () => {
    if (!pickedImage || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const result = await cropAndResizeImage(pickedImage, croppedAreaPixels);
      onChange(result);
      setPickedImage(null);
      toast.success("Photo updated - save your profile to keep it.");
    } catch {
      toast.error("Could not process that image.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar className="h-20 w-20">
        <AvatarImage src={value} alt={name} />
        <AvatarFallback className="bg-gradient-primary text-lg font-bold text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Camera className="mr-2 h-4 w-4" />
          Change photo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">JPG, PNG, or WEBP, up to 8MB. You'll crop it to a square next.</p>
      </div>

      <Dialog open={Boolean(pickedImage)} onOpenChange={(open) => !open && !isProcessing && setPickedImage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crop your photo</DialogTitle>
          </DialogHeader>

          <div className="relative h-72 w-full overflow-hidden rounded-xl bg-secondary">
            {pickedImage && (
              <Cropper
                image={pickedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                minZoom={1}
                maxZoom={3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              onValueChange={([nextZoom]) => setZoom(nextZoom)}
              min={1}
              max={3}
              step={0.01}
              aria-label="Zoom"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPickedImage(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveCrop}
              className="bg-gradient-primary text-primary-foreground"
              disabled={isProcessing || !croppedAreaPixels}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                </>
              ) : (
                "Use this photo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
