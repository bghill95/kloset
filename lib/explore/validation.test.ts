import { describe, expect, it } from "vitest";
import { validateBoardsBody, validateFeedParams, validatePinBody } from "./validation";

const params = (o: Record<string, string>) => new URLSearchParams(o);

describe("validateFeedParams", () => {
  it("defaults page and seed, omits empty q", () => {
    expect(validateFeedParams(params({}))).toEqual({
      ok: true,
      value: { page: 1, seed: 1, q: undefined },
    });
  });

  it("accepts explicit values and trims q", () => {
    expect(validateFeedParams(params({ page: "3", seed: "99", q: "  parisian chic  " }))).toEqual({
      ok: true,
      value: { page: 3, seed: 99, q: "parisian chic" },
    });
  });

  it("rejects non-integer or out-of-range page and negative seed", () => {
    expect(validateFeedParams(params({ page: "0" })).ok).toBe(false);
    expect(validateFeedParams(params({ page: "1.5" })).ok).toBe(false);
    expect(validateFeedParams(params({ page: "101" })).ok).toBe(false);
    expect(validateFeedParams(params({ seed: "-1" })).ok).toBe(false);
  });
});

describe("validatePinBody", () => {
  const GOOD = {
    source: "pinterest",
    externalId: "1104578219333637375",
    width: 800,
    height: 1000,
    alt: "Linen set",
    credit: "Fits",
    creditUrl: "",
    sourceUrl: "https://www.pinterest.com/pin/1104578219333637375/",
    imageUrl: "https://i.pinimg.com/1200x/a.jpg",
  };

  it("accepts a valid pinterest pin", () => {
    const out = validatePinBody(GOOD);
    expect(out).toEqual({ ok: true, value: GOOD });
  });

  it("rejects bad source, empty externalId, and bad dimensions", () => {
    expect(validatePinBody({ ...GOOD, source: "tumblr" }).ok).toBe(false);
    expect(validatePinBody({ ...GOOD, externalId: "" }).ok).toBe(false);
    expect(validatePinBody({ ...GOOD, width: 0 }).ok).toBe(false);
    expect(validatePinBody({ ...GOOD, height: 1.5 }).ok).toBe(false);
    expect(validatePinBody(null).ok).toBe(false);
  });

  it("blanks non-https credit/source urls and requires a valid imageUrl", () => {
    const out = validatePinBody({ ...GOOD, creditUrl: "http://x", sourceUrl: "javascript:x" });
    expect(out.ok && out.value.creditUrl).toBe("");
    expect(out.ok && out.value.sourceUrl).toBe("");
    expect(validatePinBody({ ...GOOD, imageUrl: "http://plain" }).ok).toBe(false);
  });
});

describe("validateBoardsBody", () => {
  it("accepts a boards array and trims names", () => {
    const out = validateBoardsBody({ boards: [{ id: "1", name: "  Fits " }] });
    expect(out).toEqual({ ok: true, value: [{ id: "1", name: "Fits" }] });
    // 100-char name padded with whitespace is valid after trimming.
    expect(
      validateBoardsBody({ boards: [{ id: "2", name: ` ${"x".repeat(100)} ` }] }),
    ).toEqual({ ok: true, value: [{ id: "2", name: "x".repeat(100) }] });
  });
  it("rejects non-arrays, bad entries, and oversized lists", () => {
    expect(validateBoardsBody({}).ok).toBe(false);
    expect(validateBoardsBody({ boards: [{ id: 1, name: "x" }] }).ok).toBe(false);
    expect(validateBoardsBody({ boards: [{ id: "", name: "x" }] }).ok).toBe(false);
    expect(
      validateBoardsBody({ boards: Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: "b" })) }).ok,
    ).toBe(false);
  });
});
