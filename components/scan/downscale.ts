// Resize a photo to ≤ maxEdge px (longest side) as JPEG, per spec §7.1.
// Falls back to the original blob for formats the browser can't decode
// (e.g. SVG test fixtures) — the server accepts either.
export async function downscalePhoto(
  source: Blob,
  maxEdge = 1500,
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? source;
  } catch {
    return source;
  }
}
