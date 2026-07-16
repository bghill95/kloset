// lib/ai/packing.test.ts
import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { mockPacking, packingPrompt, validatePacking } from "./packing";

const item = (id: string, category: Category): ClosetItem => ({
  id,
  name: `Item ${id}`,
  category,
  colors: ["black"],
  styleTags: [],
  imageUrl: "/x.svg",
  originalImageUrl: "/x.svg",
  createdAt: new Date("2026-01-01"),
});

describe("mockPacking", () => {
  it("is deterministic and scales caps with trip length", () => {
    const items = [
      item("t1", "top"), item("t2", "top"), item("t3", "top"), item("t4", "top"), item("t5", "top"),
      item("b1", "bottom"), item("b2", "bottom"),
      item("s1", "shoes"),
    ];
    const picks = mockPacking(items, 4);
    expect(mockPacking(items, 4)).toEqual(picks);
    expect(picks.filter((p) => p.itemId.startsWith("t"))).toHaveLength(4); // min(days, 4-cap)
    expect(picks.filter((p) => p.itemId.startsWith("b"))).toHaveLength(2); // ceil(4/2)
    expect(picks.filter((p) => p.itemId.startsWith("s"))).toHaveLength(1);
    expect(picks.every((p) => p.role.length > 0)).toBe(true);
  });

  it("returns [] for an empty closet", () => {
    expect(mockPacking([], 3)).toEqual([]);
  });
});

describe("validatePacking", () => {
  const items = [item("a", "top"), item("b", "bottom")];

  it("keeps known ids, dedupes, trims roles", () => {
    expect(
      validatePacking(
        { picks: [{ itemId: "a", role: "  Everyday top  " }, { itemId: "a", role: "dupe" }, { itemId: "ghost", role: "x" }, "junk"] },
        items,
      ),
    ).toEqual([{ itemId: "a", role: "Everyday top" }]);
  });

  it("returns [] on garbage", () => {
    expect(validatePacking(null, items)).toEqual([]);
    expect(validatePacking({ picks: "no" }, items)).toEqual([]);
  });
});

describe("packingPrompt", () => {
  const items = [item("a", "top")];
  const base = { destination: "Paris", startDate: "2026-08-01", endDate: "2026-08-04", days: 4, prefs: null };

  it("lists the forecast when present", () => {
    const prompt = packingPrompt(items, {
      ...base,
      forecast: [{ date: "2026-08-01", tempMin: 14, tempMax: 23, code: 2, label: "Partly cloudy", emoji: "⛅" }],
    });
    expect(prompt).toContain("4 day(s) in Paris");
    expect(prompt).toContain("- 2026-08-01: 14–23°, Partly cloudy");
  });

  it("falls back to seasonal guidance without a forecast", () => {
    const prompt = packingPrompt(items, { ...base, forecast: null });
    expect(prompt).toContain("No forecast available yet");
  });
});
