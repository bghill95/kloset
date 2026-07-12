import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import type { WeatherSummary } from "@/lib/context/types";

export type OutfitPick = { picks: { category: Category; item: ClosetItem }[] };

// FNV-1a, not djb2: djb2's multiplier (33) is divisible by 3, so djb2 % 3 is
// constant — rotation would never happen with 3 candidates in a slot.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function choose(
  all: ClosetItem[],
  category: Category,
  dateKey: string,
): ClosetItem | null {
  const candidates = all.filter((i) => i.category === category);
  if (candidates.length === 0) return null;
  return candidates[fnv1a(dateKey + category) % candidates.length];
}

export function pickOutfit(
  all: ClosetItem[],
  weather: WeatherSummary | null,
  dateKey: string,
): OutfitPick | null {
  const picks: OutfitPick["picks"] = [];

  const top = choose(all, "top", dateKey);
  const bottom = choose(all, "bottom", dateKey);
  if (top && bottom) {
    picks.push({ category: "top", item: top }, { category: "bottom", item: bottom });
  } else {
    const dress = choose(all, "dress", dateKey);
    if (!dress) return null;
    picks.push({ category: "dress", item: dress });
  }

  const shoes = choose(all, "shoes", dateKey);
  if (shoes) picks.push({ category: "shoes", item: shoes });

  if (weather && weather.tempMax <= 15) {
    const jacket = choose(all, "jacket", dateKey);
    if (jacket) picks.push({ category: "jacket", item: jacket });
  }
  if (weather && weather.tempMax <= 5) {
    const hat = choose(all, "hat", dateKey);
    if (hat) picks.push({ category: "hat", item: hat });
  }

  return { picks };
}
