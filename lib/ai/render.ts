import { toFile } from "openai";
import { CATEGORY_LABELS, type Category } from "@/lib/closet/categories";
import { putImage } from "@/lib/storage/blob";
import { getOpenAI } from "./openai";

const IMAGE_MODEL = "gpt-image-1";

export type RenderGarment = { name: string; category: Category; imageUrl: string };

function isMockAi(): boolean {
  return process.env.MOCK_AI === "1";
}

async function fetchImage(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed (${res.status}): ${url}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mime: res.headers.get("content-type") ?? "image/png",
  };
}

export async function runRenderPipeline(
  basePhotoUrl: string,
  garments: RenderGarment[],
): Promise<string> {
  if (isMockAi()) return "/fixtures/render.svg";

  const [base, ...cutouts] = await Promise.all([
    fetchImage(basePhotoUrl),
    ...garments.map((g) => fetchImage(g.imageUrl)),
  ]);
  const images = await Promise.all([
    toFile(base.buffer, "base.jpg", { type: base.mime }),
    ...cutouts.map((c, i) => toFile(c.buffer, `garment-${i}.png`, { type: c.mime })),
  ]);
  const list = garments
    .map((g) => `- ${g.name} (${CATEGORY_LABELS[g.category]})`)
    .join("\n");
  const res = await getOpenAI().images.edit({
    model: IMAGE_MODEL,
    quality: "medium",
    image: images,
    size: "1024x1536",
    prompt:
      "The first image is a full-body photo of a person. Dress that person in the " +
      `garments shown in the remaining images:\n${list}\n` +
      "Keep the person's face, hair, body shape, pose, and the original background " +
      "unchanged — replace only their clothing. Photorealistic fabric drape and lighting.",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("render returned no image");
  return putImage("renders/outfit.png", Buffer.from(b64, "base64"), "image/png");
}
