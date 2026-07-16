import { describe, expect, it } from "vitest";
import { buildFeedQueries, closetQueries, STAPLE_QUERIES } from "./queries";

const item = (styleTags: string[], colors: string[]) => ({ styleTags, colors });

describe("closetQueries", () => {
  it("derives tag queries first, then color queries, deduped case-insensitively", () => {
    const qs = closetQueries([
      item(["Minimalist", "y2k"], ["black"]),
      item(["minimalist"], ["black", "red"]),
    ]);
    expect(qs).toEqual([
      "minimalist outfit",
      "y2k outfit",
      "black outfit street style",
      "red outfit street style",
    ]);
  });

  it("caps at six queries", () => {
    expect(closetQueries([item(["a", "b", "c", "d", "e", "f", "g"], [])])).toHaveLength(6);
  });

  it("returns empty for an empty closet", () => {
    expect(closetQueries([])).toEqual([]);
  });
});

describe("buildFeedQueries", () => {
  it("is deterministic for a seed and contains closet + staple queries", () => {
    const items = [item(["boho"], ["white"])];
    const a = buildFeedQueries(items, 42);
    expect(buildFeedQueries(items, 42)).toEqual(a);
    expect(a).toHaveLength(2 + STAPLE_QUERIES.length);
    for (const s of STAPLE_QUERIES) expect(a).toContain(s);
  });

  it("different seeds reorder the pool", () => {
    const items = [item(["boho", "grunge", "prep"], ["white", "black", "red"])];
    const orders = new Set([1, 2, 3, 4, 5].map((s) => buildFeedQueries(items, s).join("|")));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("buildFeedQueries dedup", () => {
  it("drops a closet query that duplicates a staple", () => {
    const items = [{ styleTags: ["casual chic"], colors: [] }];
    const qs = buildFeedQueries(items, 1);
    expect(qs).toHaveLength(STAPLE_QUERIES.length);
    expect(new Set(qs).size).toBe(qs.length);
  });
});
