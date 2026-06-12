import { del, put } from "@vercel/blob";

export async function putImage(
  path: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const { url } = await put(path, data, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return url;
}

// Best-effort cleanup. MOCK_AI fixture URLs are root-relative — skip those.
export async function deleteImages(urls: Array<string | null>): Promise<void> {
  const blobUrls = urls.filter(
    (u): u is string => !!u && u.startsWith("https://"),
  );
  if (blobUrls.length === 0) return;
  try {
    await del(blobUrls);
  } catch {
    // Orphaned blobs are preferable to a failed delete request.
  }
}
