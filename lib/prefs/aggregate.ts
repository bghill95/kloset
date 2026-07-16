import type { ClosetItem } from "@/lib/closet/types";
import type { Verdict } from "./validation";

export type Vote = { itemIds: string[]; verdict: Verdict };
export type ItemScore = { likes: number; dislikes: number };
export type TasteProfile = {
  likedTags: string[];
  dislikedTags: string[];
  likedColors: string[];
  dislikedColors: string[];
};
export type PrefsSignal = { scores: Record<string, ItemScore>; profile: TasteProfile };

const MAX_TASTE = 5;

export function itemScores(votes: Vote[]): Record<string, ItemScore> {
  const scores: Record<string, ItemScore> = {};
  for (const vote of votes) {
    for (const id of vote.itemIds) {
      const s = (scores[id] ??= { likes: 0, dislikes: 0 });
      if (vote.verdict === "like") s.likes += 1;
      else s.dislikes += 1;
    }
  }
  return scores;
}

// "Hard-disliked" = net negative. Today's pick filters these out.
export function hardDisliked(votes: Vote[]): string[] {
  return Object.entries(itemScores(votes))
    .filter(([, s]) => s.dislikes > s.likes)
    .map(([id]) => id);
}

function bump(map: Map<string, number>, raw: string, sign: number): void {
  const key = raw.trim().toLowerCase();
  if (key) map.set(key, (map.get(key) ?? 0) + sign);
}

function top(map: Map<string, number>, sign: 1 | -1): string[] {
  return [...map.entries()]
    .filter(([, net]) => sign * net > 0)
    .sort((a, b) => sign * (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, MAX_TASTE)
    .map(([k]) => k);
}

export function tasteProfile(
  votes: Vote[],
  items: Pick<ClosetItem, "id" | "styleTags" | "colors">[],
): TasteProfile {
  const byId = new Map(items.map((i) => [i.id, i]));
  const tagNet = new Map<string, number>();
  const colorNet = new Map<string, number>();
  for (const vote of votes) {
    const sign = vote.verdict === "like" ? 1 : -1;
    for (const id of vote.itemIds) {
      const item = byId.get(id);
      if (!item) continue;
      for (const t of item.styleTags) bump(tagNet, t, sign);
      for (const c of item.colors) bump(colorNet, c, sign);
    }
  }
  return {
    likedTags: top(tagNet, 1),
    dislikedTags: top(tagNet, -1),
    likedColors: top(colorNet, 1),
    dislikedColors: top(colorNet, -1),
  };
}

export function tasteLines(p: TasteProfile): string[] {
  const lines: string[] = [];
  const likes = [...p.likedTags, ...p.likedColors];
  const avoid = [...p.dislikedTags, ...p.dislikedColors];
  if (likes.length > 0) lines.push(`Her feedback says she likes: ${likes.join(", ")}.`);
  if (avoid.length > 0) lines.push(`Her feedback says to avoid: ${avoid.join(", ")}.`);
  return lines;
}

export function prefsSignal(
  votes: Vote[],
  items: Pick<ClosetItem, "id" | "styleTags" | "colors">[],
): PrefsSignal {
  return { scores: itemScores(votes), profile: tasteProfile(votes, items) };
}
