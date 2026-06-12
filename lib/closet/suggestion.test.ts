import { describe, expect, it } from "vitest";
import {
  deriveName,
  mismatchWarning,
  validateSuggestion,
} from "./suggestion";

describe("validateSuggestion", () => {
  it("accepts a well-formed suggestion and normalizes strings", () => {
    const s = validateSuggestion({
      name: "  Light blue oxford shirt  ",
      colors: [" Light Blue ", "WHITE"],
      styleTags: ["Smart Casual"],
      detectedCategory: "top",
    });
    expect(s).toEqual({
      name: "Light blue oxford shirt",
      colors: ["light blue", "white"],
      styleTags: ["smart casual"],
      detectedCategory: "top",
    });
  });

  it("rejects non-objects and missing names", () => {
    expect(validateSuggestion(null)).toBeNull();
    expect(validateSuggestion("nope")).toBeNull();
    expect(validateSuggestion({ colors: ["red"] })).toBeNull();
    expect(validateSuggestion({ name: "   " })).toBeNull();
  });

  it("caps name length and array sizes, drops junk entries", () => {
    const s = validateSuggestion({
      name: "x".repeat(200),
      colors: ["red", 5, "", "blue", "green", "grey", "navy", "tan", "pink"],
      styleTags: Array.from({ length: 20 }, (_, i) => `tag${i}`),
      detectedCategory: "sock",
    });
    expect(s?.name).toHaveLength(80);
    expect(s?.colors).toEqual(["red", "blue", "green", "grey", "navy", "tan"]);
    expect(s?.styleTags).toHaveLength(10);
    expect(s?.detectedCategory).toBeNull();
  });
});

describe("mismatchWarning", () => {
  const base = { name: "Shirt", colors: [], styleTags: [] };

  it("is null when categories agree or detection is missing", () => {
    expect(mismatchWarning(null, "top")).toBeNull();
    expect(
      mismatchWarning({ ...base, detectedCategory: null }, "top"),
    ).toBeNull();
    expect(
      mismatchWarning({ ...base, detectedCategory: "top" }, "top"),
    ).toBeNull();
  });

  it("describes the mismatch otherwise", () => {
    expect(
      mismatchWarning({ ...base, detectedCategory: "jacket" }, "top"),
    ).toBe("This looks more like a jacket than a top.");
  });
});

describe("deriveName", () => {
  it("uses the first color when available", () => {
    expect(deriveName("top", ["light blue", "white"])).toBe("Light blue top");
  });

  it("falls back to a generic name", () => {
    expect(deriveName("shoes", [])).toBe("New shoes");
  });
});
