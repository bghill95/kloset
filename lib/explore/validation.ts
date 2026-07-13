import { isImageUrl, type Result } from "@/lib/closet/item-validation";
import type { Pin } from "./pexels";

const MAX_QUERY = 100;
const MAX_PAGE = 100;
const MAX_TEXT = 300;
const MAX_URL = 2048;

export type FeedParams = { page: number; seed: number; q?: string };

export function validateFeedParams(params: URLSearchParams): Result<FeedParams> {
  const page = Number(params.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return { ok: false, error: `page must be an integer between 1 and ${MAX_PAGE}.` };
  }
  const seed = Number(params.get("seed") ?? "1");
  if (!Number.isInteger(seed) || seed < 0) {
    return { ok: false, error: "seed must be a non-negative integer." };
  }
  const rawQ = params.get("q");
  const q = rawQ ? rawQ.trim().slice(0, MAX_QUERY) : undefined;
  return { ok: true, value: { page, seed, q: q || undefined } };
}

// Credit links are display-only <a href>s — blank anything non-https rather
// than rejecting the save.
function httpsOrBlank(v: unknown): string {
  return typeof v === "string" && v.length <= MAX_URL && v.startsWith("https://") ? v : "";
}

function textOrBlank(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "";
}

export function validatePinBody(raw: unknown): Result<Pin> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.pexelsId !== "number" || !Number.isInteger(o.pexelsId) || o.pexelsId < 0) {
    return { ok: false, error: "pexelsId must be a non-negative integer." };
  }
  if (
    typeof o.width !== "number" ||
    typeof o.height !== "number" ||
    !Number.isInteger(o.width) ||
    !Number.isInteger(o.height) ||
    o.width < 1 ||
    o.height < 1
  ) {
    return { ok: false, error: "width and height must be positive integers." };
  }
  if (!isImageUrl(o.imageUrl)) {
    return { ok: false, error: "imageUrl must be an https or root-relative URL." };
  }
  return {
    ok: true,
    value: {
      pexelsId: o.pexelsId,
      width: o.width,
      height: o.height,
      alt: textOrBlank(o.alt),
      photographer: textOrBlank(o.photographer),
      photographerUrl: httpsOrBlank(o.photographerUrl),
      pexelsUrl: httpsOrBlank(o.pexelsUrl),
      imageUrl: o.imageUrl,
    },
  };
}
