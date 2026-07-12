import { type Result, UUID_RE } from "@/lib/closet/item-validation";

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type NewWear = { outfitId: string; wornOn: string };

export function validateNewWear(raw: unknown): Result<NewWear> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.outfitId !== "string" || !UUID_RE.test(o.outfitId)) {
    return { ok: false, error: "outfitId must be an outfit UUID." };
  }
  if (typeof o.wornOn !== "string" || !DATE_KEY_RE.test(o.wornOn)) {
    return { ok: false, error: "wornOn must be a YYYY-MM-DD date." };
  }
  return { ok: true, value: { outfitId: o.outfitId, wornOn: o.wornOn } };
}
