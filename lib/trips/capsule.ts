import type { ClosetItem } from "@/lib/closet/types";

export type CapsulePick = { itemId: string; role: string };
export type CapsuleEntry = CapsulePick & { name: string; imageUrl: string };

// trips.capsule column holds JSON-encoded CapsulePick[]; tolerate anything.
export function parseCapsule(raw: string): CapsulePick[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((e) => {
    if (typeof e !== "object" || e === null) return [];
    const o = e as Record<string, unknown>;
    return typeof o.itemId === "string" && typeof o.role === "string"
      ? [{ itemId: o.itemId, role: o.role }]
      : [];
  });
}

// Deleted items drop out of the checklist at read time (no FK, house pattern).
export function joinCapsule(
  picks: CapsulePick[],
  items: Pick<ClosetItem, "id" | "name" | "imageUrl">[],
): CapsuleEntry[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return picks.flatMap((p) => {
    const item = byId.get(p.itemId);
    return item ? [{ ...p, name: item.name, imageUrl: item.imageUrl }] : [];
  });
}
