import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { gapsPrompt, mockGaps, validateGaps } from "./gaps";

const item = (id: string, category: Category): ClosetItem => ({
  id,
  name: `Item ${id}`,
  category,
  colors: [],
  styleTags: [],
  imageUrl: "/x.svg",
  originalImageUrl: "/x.svg",
  createdAt: new Date("2026-01-01"),
});

describe("mockGaps", () => {
  it("suggests missing categories, capped at three", () => {
    const gaps = mockGaps([item("t", "top"), item("b", "bottom")]);
    expect(gaps).toHaveLength(3);
    expect(gaps[0].piece).toBe("A versatile jacket");
  });

  it("falls back to one suggestion when the wishlist is covered", () => {
    const gaps = mockGaps([
      item("t", "top"), item("b", "bottom"), item("j", "jacket"),
      item("d", "dress"), item("a", "accessory"), item("h", "hat"),
    ]);
    expect(gaps).toEqual([
      {
        piece: "A statement layer",
        reason: "Your basics are covered — one bold piece unlocks new combinations.",
      },
    ]);
  });

  it("returns [] for an empty closet", () => {
    expect(mockGaps([])).toEqual([]);
  });
});

describe("validateGaps", () => {
  it("trims, caps at three, drops malformed", () => {
    expect(
      validateGaps({
        gaps: [
          { piece: "  White sneakers ", reason: " Pairs with everything. " },
          { piece: 7, reason: "bad" },
          { piece: "A", reason: "B" },
          { piece: "C", reason: "D" },
          { piece: "E", reason: "F" },
        ],
      }),
    ).toEqual([
      { piece: "White sneakers", reason: "Pairs with everything." },
      { piece: "A", reason: "B" },
      { piece: "C", reason: "D" },
    ]);
    expect(validateGaps(null)).toEqual([]);
  });
});

describe("gapsPrompt", () => {
  it("includes the inventory and the buy framing", () => {
    const prompt = gapsPrompt([item("t", "top")], null);
    expect(prompt).toContain("t | top | Item t");
    expect(prompt).toContain("unlock the most new outfits");
  });
});
