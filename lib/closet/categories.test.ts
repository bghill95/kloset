import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_PLURAL_LABELS, isCategory } from "./categories";

describe("categories", () => {
  it("includes dress and accessory in UI order", () => {
    expect(CATEGORIES).toEqual(["top", "bottom", "dress", "jacket", "shoes", "hat", "accessory"]);
  });
  it("accepts new categories", () => {
    expect(isCategory("dress")).toBe(true);
    expect(isCategory("accessory")).toBe(true);
    expect(isCategory("sock")).toBe(false);
  });
  it("labels every category", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
      expect(CATEGORY_PLURAL_LABELS[c]).toBeTruthy();
    }
  });
});
