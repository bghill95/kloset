import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";
import { putImage } from "@/lib/storage/blob";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 3;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A photo is required." }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo too large (max 10 MB)." },
      { status: 413 },
    );
  }

  const existing = await getDb().select().from(basePhotos);
  if (existing.length >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: "You already have 3 base photos — delete one first." },
      { status: 409 },
    );
  }

  try {
    let imageUrl: string;
    if (process.env.MOCK_AI === "1") {
      imageUrl = "/fixtures/base-photo.svg";
    } else {
      const buffer = Buffer.from(await photo.arrayBuffer());
      imageUrl = await putImage(
        "base-photos/photo.jpg",
        buffer,
        photo.type || "image/jpeg",
      );
    }
    const [created] = await getDb()
      .insert(basePhotos)
      // No primary among existing photos (first upload, or healing a crash
      // between PATCH's demote/promote) → this one becomes primary.
      .values({ imageUrl, isPrimary: !existing.some((p) => p.isPrimary) })
      .returning();
    return NextResponse.json({ photo: created }, { status: 201 });
  } catch (err) {
    console.error("[base-photos] upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed — try again." },
      { status: 502 },
    );
  }
}
