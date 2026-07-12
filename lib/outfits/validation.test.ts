import { describe, expect, it } from "vitest";
import {
  checkOutfitItems,
  validateItemIds,
  validateNewOutfit,
} from "./validation";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("validateItemIds", () => {
  it("accepts a list of UUIDs and dedupes", () => {
    const r = validateItemIds([A, B, A]);
    expect(r).toEqual({ ok: true, value: [A, B] });
  });
  it("rejects non-arrays, non-UUIDs, and empty lists", () => {
    expect(validateItemIds("nope").ok).toBe(false);
    expect(validateItemIds(["not-a-uuid"]).ok).toBe(false);
    expect(validateItemIds([]).ok).toBe(false);
  });
  it("rejects more than one item per category slot count (7)", () => {
    const ids = Array.from({ length: 8 }, (_, i) => A.replace("1111-1111", `1111-11${String(i).padStart(2, "0")}`));
    expect(validateItemIds(ids).ok).toBe(false);
  });
});

describe("validateNewOutfit", () => {
  it("accepts name + itemIds and defaults renderUrl to null", () => {
    const r = validateNewOutfit({ name: " Friday fit ", itemIds: [A] });
    expect(r).toEqual({
      ok: true,
      value: { name: "Friday fit", itemIds: [A], renderUrl: null, source: "studio" },
    });
  });
  it("accepts a blob or fixture renderUrl", () => {
    const r = validateNewOutfit({ name: "x", itemIds: [A], renderUrl: "/fixtures/render.svg" });
    expect(r.ok && r.value.renderUrl).toBe("/fixtures/render.svg");
  });
  it("rejects a missing name, bad itemIds, or a junk renderUrl", () => {
    expect(validateNewOutfit({ itemIds: [A] }).ok).toBe(false);
    expect(validateNewOutfit({ name: "x", itemIds: "no" }).ok).toBe(false);
    expect(validateNewOutfit({ name: "x", itemIds: [A], renderUrl: "javascript:alert(1)" }).ok).toBe(false);
  });
});

describe("checkOutfitItems", () => {
  it("passes when every id resolved and categories are distinct", () => {
    expect(
      checkOutfitItems([A, B], [
        { id: A, category: "top" },
        { id: B, category: "bottom" },
      ]),
    ).toBeNull();
  });
  it("flags missing items", () => {
    expect(checkOutfitItems([A, B], [{ id: A, category: "top" }])).toBe(
      "Some items no longer exist.",
    );
  });
  it("flags two items in one category", () => {
    expect(
      checkOutfitItems([A, B], [
        { id: A, category: "top" },
        { id: B, category: "top" },
      ]),
    ).toBe("Outfits take at most one item per category.");
  });
});

describe("validateNewOutfit source", () => {
  const base = { name: "Look", itemIds: [A], renderUrl: null };

  it("defaults source to studio", () => {
    const r = validateNewOutfit(base);
    expect(r.ok && r.value.source).toBe("studio");
  });

  it("accepts stylist and today", () => {
    for (const source of ["stylist", "today"]) {
      const r = validateNewOutfit({ ...base, source });
      expect(r.ok && r.value.source).toBe(source);
    }
  });

  it("rejects unknown sources", () => {
    const r = validateNewOutfit({ ...base, source: "closet" });
    expect(r.ok).toBe(false);
  });
});
