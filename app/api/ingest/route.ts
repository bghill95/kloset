import { NextRequest, NextResponse } from "next/server";
import { runIngestPipeline } from "@/lib/ai/ingest";
import { isCategory } from "@/lib/closet/categories";

// Cutout + tagging can take a while on a slow day.
export const maxDuration = 60;

// Note: Vercel rejects bodies over ~4.5 MB at the platform edge before this
// runs, so in production this cap only documents intent; the client-side
// resize (≤1500px JPEG) keeps real uploads far below both limits.
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const photo = form.get("photo");
  const category = form.get("category");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A photo is required." }, { status: 400 });
  }
  if (!isCategory(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo too large (max 10 MB)." },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const result = await runIngestPipeline(
      buffer,
      photo.type || "image/jpeg",
      category,
    );
    return NextResponse.json(result);
  } catch (err) {
    // Only infrastructure (the original Blob upload) throws — AI failures
    // come back as partial results from the pipeline.
    console.error("[ingest] pipeline failed:", err);
    return NextResponse.json(
      { error: "Upload failed — try again." },
      { status: 502 },
    );
  }
}
