export type DayWear = { outfitId: string; itemIds: string[] };

// Exact set equality: the logged outfit is precisely today's pick.
export function findWornMatch(wears: DayWear[], pickIds: string[]): string | null {
  const want = new Set(pickIds);
  for (const w of wears) {
    if (w.itemIds.length === want.size && w.itemIds.every((id) => want.has(id))) {
      return w.outfitId;
    }
  }
  return null;
}
