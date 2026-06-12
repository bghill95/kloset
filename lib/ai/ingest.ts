import { toFile } from "openai";
import { CATEGORIES, type Category } from "@/lib/closet/categories";
import {
  mismatchWarning,
  type Suggestion,
  validateSuggestion,
} from "@/lib/closet/suggestion";
import { putImage } from "@/lib/storage/blob";
import { getOpenAI } from "./openai";

export type IngestResult = {
  originalUrl: string;
  cutoutUrl: string | null;
  suggestion: Suggestion | null;
  warning: string | null;
};

const IMAGE_MODEL = "gpt-image-1";
const VISION_MODEL = "gpt-4.1-mini";

function isMockAi(): boolean {
  return process.env.MOCK_AI === "1";
}

export async function runIngestPipeline(
  photo: Buffer,
  mime: string,
  category: Category,
): Promise<IngestResult> {
  if (isMockAi()) {
    const suggestion: Suggestion = {
      name: "Light blue oxford shirt",
      colors: ["light blue"],
      styleTags: ["smart casual", "all-season"],
      detectedCategory: category,
    };
    return {
      originalUrl: "/fixtures/original-top.svg",
      cutoutUrl: "/fixtures/cutout-top.svg",
      suggestion,
      warning: null,
    };
  }

  const ext = mime === "image/png" ? "png" : "jpg";
  // If even the original upload fails there is nothing to confirm — let it throw;
  // the route maps it to 502. AI failures below degrade to partial results.
  const originalUrl = await putImage(`items/original.${ext}`, photo, mime);
  const [cutoutUrl, suggestion] = await Promise.all([
    cutout(photo, mime).catch(() => null),
    tag(photo, mime, category).catch(() => null),
  ]);
  return {
    originalUrl,
    cutoutUrl,
    suggestion,
    warning: mismatchWarning(suggestion, category),
  };
}

async function cutout(photo: Buffer, mime: string): Promise<string | null> {
  const res = await getOpenAI().images.edit({
    model: IMAGE_MODEL,
    image: await toFile(photo, "garment", { type: mime }),
    prompt:
      "Remove the background completely. Keep only the clothing item, " +
      "unaltered and centered, on a fully transparent background.",
    background: "transparent",
    size: "1024x1024",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) return null;
  return putImage("items/cutout.png", Buffer.from(b64, "base64"), "image/png");
}

async function tag(
  photo: Buffer,
  mime: string,
  category: Category,
): Promise<Suggestion | null> {
  const res = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "garment_tags",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["name", "colors", "styleTags", "detectedCategory"],
          properties: {
            name: { type: "string" },
            colors: { type: "array", items: { type: "string" } },
            styleTags: { type: "array", items: { type: "string" } },
            detectedCategory: { type: "string", enum: [...CATEGORIES] },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Catalog this garment for a personal closet. The user filed it as a "${category}". ` +
              `Return: name (short and descriptive, e.g. "Light blue oxford shirt"); ` +
              `colors (1-4 lowercase color names); ` +
              `styleTags (2-6 lowercase tags covering formality, season, warmth); ` +
              `detectedCategory (what the photo actually shows).`,
          },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${photo.toString("base64")}` },
          },
        ],
      },
    ],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return null;
  return validateSuggestion(JSON.parse(text));
}
