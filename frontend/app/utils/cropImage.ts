export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OUTPUT_SIZE = 512; // square edge of the produced image (matches server normalization)
const MAX_BYTES = 1_048_576; // keep the upload under the server's 1 MB cap

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('Failed to load image')));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Crop `imageSrc` to the given pixel region and return a square JPEG blob, scaled
 * to OUTPUT_SIZE. Quality is stepped down if needed to stay under the 1 MB cap.
 */
export async function getCroppedBlob(imageSrc: string, crop: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= MAX_BYTES) return blob;
    if (quality === 0.5 && blob) return blob; // best effort; server also re-encodes
  }
  throw new Error('Failed to encode image');
}
