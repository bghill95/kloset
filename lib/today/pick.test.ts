import { describe, expect, it } from "vitest";
import type { ClosetItem } from "@/lib/closet/types";
import type { WeatherSummary } from "@/lib/context/types";
import { pickOutfit } from "./pick";

let n = 0;
function item(category: ClosetItem["category"], name?: string): ClosetItem {
  n += 1;
  return {
    id: `id-${n}`,
    name: name ?? `${category} ${n}`,
    category,
    colors: [],
    styleTags: [],
    imageUrl: `https://mock/img-${n}.png`,
    originalImageUrl: `https://mock/orig-${n}.png`,
    createdAt: new Date("2026-07-01T00:00:00Z"),
  };
}

const COLD: WeatherSummary = { tempMin: 1, tempMax: 5, code: 3, label: "Overcast", emoji: "☁️" };
const MILD: WeatherSummary = { tempMin: 10, tempMax: 14, code: 2, label: "Cloudy", emoji: "⛅" };
const WARM: WeatherSummary = { tempMin: 18, tempMax: 26, code: 0, label: "Clear", emoji: "☀️" };

describe("pickOutfit", () => {
  it("returns null for an empty closet", () => {
    expect(pickOutfit([], WARM, "2026-07-11")).toBeNull();
  });

  it("returns null when no base outfit is possible (only shoes)", () => {
    expect(pickOutfit([item("shoes")], WARM, "2026-07-11")).toBeNull();
  });

  it("picks top + bottom + shoes on a warm day", () => {
    const closet = [item("top"), item("bottom"), item("shoes"), item("jacket"), item("hat")];
    const pick = pickOutfit(closet, WARM, "2026-07-11");
    expect(pick?.picks.map((p) => p.category)).toEqual(["top", "bottom", "shoes"]);
  });

  it("falls back to a dress when there are no bottoms", () => {
    const closet = [item("top"), item("dress"), item("shoes")];
    const pick = pickOutfit(closet, WARM, "2026-07-11");
    expect(pick?.picks.map((p) => p.category)).toEqual(["dress", "shoes"]);
  });

  it("adds a jacket at 15° or below, and a hat at 5° or below", () => {
    const closet = [item("top"), item("bottom"), item("jacket"), item("hat")];
    expect(pickOutfit(closet, MILD, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom", "jacket",
    ]);
    expect(pickOutfit(closet, COLD, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom", "jacket", "hat",
    ]);
  });

  it("works without weather (no jacket/hat)", () => {
    const closet = [item("top"), item("bottom"), item("jacket")];
    expect(pickOutfit(closet, null, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom",
    ]);
  });

  it("is deterministic for a dateKey and rotates across dates", () => {
    const closet = [item("top", "A"), item("top", "B"), item("top", "C"), item("bottom")];
    const first = pickOutfit(closet, null, "2026-07-11");
    const again = pickOutfit(closet, null, "2026-07-11");
    expect(first?.picks[0].item.id).toBe(again?.picks[0].item.id);
    const tops = new Set(
      Array.from({ length: 10 }, (_, i) =>
        pickOutfit(closet, null, `2026-07-${String(11 + i).padStart(2, "0")}`)?.picks[0].item.id,
      ),
    );
    expect(tops.size).toBeGreaterThan(1);
  });
});
