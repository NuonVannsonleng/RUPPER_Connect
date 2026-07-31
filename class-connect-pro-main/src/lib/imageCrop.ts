export const MAX_AVATAR_DIMENSION = 512;

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load that image"));
    image.src = src;
  });

/**
 * Draws the cropped region onto a fixed-size square canvas and re-encodes it, so what
 * actually gets uploaded is a small, uniform avatar rather than whatever the original photo
 * happened to be - a 12MP phone photo and a 40x40 icon both come out the same size.
 */
export async function cropAndResizeImage(
  imageSrc: string,
  crop: PixelCrop,
  outputSize = MAX_AVATAR_DIMENSION,
  quality = 0.85
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images");

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not process that image"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      },
      "image/webp",
      quality
    );
  });
}
