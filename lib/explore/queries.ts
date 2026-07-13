import type { ClosetItem } from "@/lib/closet/types";

export const STAPLE_QUERIES = [
  "street style fashion",
  "outfit inspiration",
  "fashion editorial",
  "casual chic outfit",
  "minimal wardrobe style",
];

const MAX_CLOSET_QUERIES = 6;

type Seedable = Pick<ClosetItem, "styleTags" | "colors">;

// Tags make better search queries than colors; colors pad if tags run short.
export function closetQueries(items: Seedable[]): string[] {
  const norm = (v: string) => v.trim().toLowerCase();
  const tags = [...new Set(items.flatMap((i) => i.styleTags.map(norm)))].filter(Boolean);
  const colors = [...new Set(items.flatMap((i) => i.colors.map(norm)))].filter(Boolean);
  return [
    ...tags.map((t) => `${t} outfit`),
    ...colors.map((c) => `${c} outfit street style`),
  ].slice(0, MAX_CLOSET_QUERIES);
}

// mulberry32 — tiny deterministic PRNG so a seed reproduces its shuffle.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildFeedQueries(items: Seedable[], seed: number): string[] {
  const pool = [...closetQueries(items), ...STAPLE_QUERIES];
  const rand = rng(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}
