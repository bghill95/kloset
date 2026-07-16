import { type Result, UUID_RE } from "@/lib/closet/item-validation";
import { OUTFIT_SOURCES, type OutfitSource, validateItemIds } from "@/lib/outfits/validation";

export const VERDICTS = ["like", "dislike"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type NewVote = { itemIds: string[]; verdict: Verdict; source: OutfitSource };

// One vote row per distinct combo: lowercased, sorted, comma-joined ids.
export function voteKey(itemIds: string[]): string {
  return itemIds
    .map((id) => id.toLowerCase())
    .sort()
    .join(",");
}

export function validateVoteBody(raw: unknown): Result<NewVote> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.verdict !== "string" || !(VERDICTS as readonly string[]).includes(o.verdict)) {
    return { ok: false, error: "verdict must be 'like' or 'dislike'." };
  }
  const ids = validateItemIds(o.itemIds);
  if (!ids.ok) return ids;
  const source = (o.source ?? "stylist") as string;
  if (!(OUTFIT_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, error: "Invalid source." };
  }
  return {
    ok: true,
    value: { itemIds: ids.value, verdict: o.verdict as Verdict, source: source as OutfitSource },
  };
}

export function validateItemsParam(raw: string | null): Result<string[]> {
  if (!raw) return { ok: false, error: "items is required (comma-separated item UUIDs)." };
  const parts = raw.split(",");
  if (!parts.every((p) => UUID_RE.test(p))) {
    return { ok: false, error: "items must be item UUIDs." };
  }
  return { ok: true, value: [...new Set(parts)] };
}
