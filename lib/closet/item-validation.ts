import { type Category, isCategory } from "./categories";
import { cleanStrings, MAX_COLORS, MAX_TAGS } from "./suggestion";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NewItem = {
  name: string;
  category: Category;
  colors: string[];
  styleTags: string[];
  imageUrl: string;
  originalImageUrl: string;
};

export type ItemPatch = Partial<
  Pick<NewItem, "name" | "category" | "colors" | "styleTags">
>;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_NAME = 120;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME ? trimmed : null;
}

// Blob URLs are https; MOCK_AI fixtures are root-relative paths.
function isImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("https://") || value.startsWith("/"))
  );
}

export function validateNewItem(raw: unknown): Result<NewItem> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  const name = cleanName(o.name);
  if (!name) return { ok: false, error: "Name is required (max 120 chars)." };
  if (!isCategory(o.category)) return { ok: false, error: "Invalid category." };
  if (!isImageUrl(o.imageUrl)) return { ok: false, error: "Invalid imageUrl." };
  if (!isImageUrl(o.originalImageUrl)) {
    return { ok: false, error: "Invalid originalImageUrl." };
  }
  return {
    ok: true,
    value: {
      name,
      category: o.category,
      colors: cleanStrings(o.colors, MAX_COLORS),
      styleTags: cleanStrings(o.styleTags, MAX_TAGS),
      imageUrl: o.imageUrl,
      originalImageUrl: o.originalImageUrl,
    },
  };
}

export function validateItemPatch(raw: unknown): Result<ItemPatch> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  const patch: ItemPatch = {};
  if ("name" in o) {
    const name = cleanName(o.name);
    if (!name) return { ok: false, error: "Invalid name." };
    patch.name = name;
  }
  if ("category" in o) {
    if (!isCategory(o.category)) {
      return { ok: false, error: "Invalid category." };
    }
    patch.category = o.category;
  }
  if ("colors" in o) patch.colors = cleanStrings(o.colors, MAX_COLORS);
  if ("styleTags" in o) patch.styleTags = cleanStrings(o.styleTags, MAX_TAGS);
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No editable fields provided." };
  }
  return { ok: true, value: patch };
}
