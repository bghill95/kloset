import { describe, expect, it } from "vitest";
import { validateItemPatch, validateNewItem } from "./item-validation";

const valid = {
  name: "Light blue oxford shirt",
  category: "top",
  colors: ["light blue"],
  styleTags: ["smart casual"],
  imageUrl: "https://blob.example.com/cutout.png",
  originalImageUrl: "/fixtures/original-top.svg",
};

describe("validateNewItem", () => {
  it("accepts a valid payload", () => {
    const r = validateNewItem(valid);
    expect(r).toEqual({ ok: true, value: valid });
  });

  it("defaults missing arrays to empty", () => {
    const { colors: _c, styleTags: _s, ...rest } = valid;
    const r = validateNewItem(rest);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.colors).toEqual([]);
      expect(r.value.styleTags).toEqual([]);
    }
  });

  it.each([
    ["missing name", { ...valid, name: "  " }],
    ["bad category", { ...valid, category: "sock" }],
    ["bad imageUrl", { ...valid, imageUrl: "javascript:alert(1)" }],
    ["bad originalImageUrl", { ...valid, originalImageUrl: "" }],
    ["non-object", "nope"],
  ])("rejects %s", (_label, payload) => {
    expect(validateNewItem(payload).ok).toBe(false);
  });
});

describe("validateItemPatch", () => {
  it("accepts a partial update", () => {
    const r = validateItemPatch({ name: "Renamed", category: "jacket" });
    expect(r).toEqual({
      ok: true,
      value: { name: "Renamed", category: "jacket" },
    });
  });

  it("rejects an empty patch", () => {
    expect(validateItemPatch({}).ok).toBe(false);
  });

  it("rejects invalid fields even when others are valid", () => {
    expect(validateItemPatch({ name: "ok", category: "sock" }).ok).toBe(false);
  });

  it("normalizes colors and styleTags", () => {
    const r = validateItemPatch({ colors: [" Red ", ""], styleTags: ["WARM"] });
    expect(r).toEqual({
      ok: true,
      value: { colors: ["red"], styleTags: ["warm"] },
    });
  });
});
