import { describe, expect, it } from "vitest";
import { UUID_RE, validateItemPatch, validateNewItem } from "./item-validation";

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
    ["non-array colors", { ...valid, colors: "red" }],
    ["protocol-relative imageUrl", { ...valid, imageUrl: "//evil.com/x.png" }],
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

  it("rejects non-array colors instead of wiping them", () => {
    expect(validateItemPatch({ colors: "red" }).ok).toBe(false);
    expect(validateItemPatch({ styleTags: null }).ok).toBe(false);
  });
});

describe("UUID_RE", () => {
  it("matches standard UUIDs, either case", () => {
    expect(UUID_RE.test("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(UUID_RE.test("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(UUID_RE.test("123e4567e89b12d3a456426614174000")).toBe(false);
    expect(UUID_RE.test("123e4567-e89b-12d3-a456-42661417400g")).toBe(false);
    expect(UUID_RE.test("123e4567-e89b-12d3-a456-426614174000\n")).toBe(false);
  });
});
