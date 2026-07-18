import type { pins, pinterestPins } from "@/lib/db/schema";
import type { FeedPage, Pin, SavedPin } from "./pinterest";

export const PER_PAGE = 30;

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

// Browse mode shuffles by seed (the Shuffle button rerolls it); search keeps
// the caller's order (savedAt desc from the route) so results are stable.
export function pageFeed(all: Pin[], page: number, seed: number, q?: string): FeedPage {
  let list: Pin[];
  if (q) {
    const needle = q.toLowerCase();
    list = all.filter(
      (p) => p.alt.toLowerCase().includes(needle) || p.credit.toLowerCase().includes(needle),
    );
  } else {
    list = [...all];
    const rand = rng(seed);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const start = (page - 1) * PER_PAGE;
  return { pins: list.slice(start, start + PER_PAGE), hasMore: start + PER_PAGE < list.length };
}

export function rowToPin(r: typeof pinterestPins.$inferSelect): Pin {
  return {
    source: "pinterest",
    externalId: r.id,
    width: r.width,
    height: r.height,
    alt: r.title || r.description,
    credit: r.boardName,
    creditUrl: "",
    sourceUrl: r.link,
    imageUrl: r.imageUrl,
  };
}

export function savedRowToPin(r: typeof pins.$inferSelect): SavedPin {
  return {
    id: r.id,
    source: r.source,
    externalId: r.externalId,
    width: r.width,
    height: r.height,
    alt: r.alt,
    credit: r.photographer,
    creditUrl: r.photographerUrl,
    sourceUrl: r.pexelsUrl,
    imageUrl: r.imageUrl,
  };
}
