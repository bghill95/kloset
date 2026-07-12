import { CATEGORIES } from "@/lib/closet/categories";
import {
  cleanName,
  isImageUrl,
  type Result,
  UUID_RE,
} from "@/lib/closet/item-validation";

export const OUTFIT_SOURCES = ["studio", "stylist", "today"] as const;
export type OutfitSource = (typeof OUTFIT_SOURCES)[number];

export type NewOutfit = {
  name: string;
  itemIds: string[];
  renderUrl: string | null;
  source: OutfitSource;
};

export function validateItemIds(raw: unknown): Result<string[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "itemIds must be an array." };
  }
  if (!raw.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) {
    return { ok: false, error: "itemIds must be item UUIDs." };
  }
  const ids = [...new Set(raw)];
  if (ids.length === 0 || ids.length > CATEGORIES.length) {
    return { ok: false, error: `Pick between 1 and ${CATEGORIES.length} items.` };
  }
  return { ok: true, value: ids };
}

export function validateNewOutfit(raw: unknown): Result<NewOutfit> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  const name = cleanName(o.name);
  if (!name) return { ok: false, error: "Name is required (max 120 chars)." };
  const ids = validateItemIds(o.itemIds);
  if (!ids.ok) return ids;
  if (o.renderUrl != null && !isImageUrl(o.renderUrl)) {
    return { ok: false, error: "Invalid renderUrl." };
  }
  const source = (o.source ?? "studio") as string;
  if (!(OUTFIT_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, error: "Invalid source." };
  }
  return {
    ok: true,
    value: {
      name,
      itemIds: ids.value,
      renderUrl: (o.renderUrl as string | undefined) ?? null,
      source: source as OutfitSource,
    },
  };
}

// After the route fetches the referenced items, verify the outfit is buildable.
export function checkOutfitItems(
  requested: string[],
  found: { id: string; category: string }[],
): string | null {
  if (found.length !== requested.length) return "Some items no longer exist.";
  if (new Set(found.map((i) => i.category)).size !== found.length) {
    return "Outfits take at most one item per category.";
  }
  return null;
}
