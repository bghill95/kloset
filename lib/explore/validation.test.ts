import { describe, expect, it } from "vitest";
import { validateFeedParams, validatePinBody } from "./validation";

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
  const good = {
    pexelsId: 7,
    width: 800,
    height: 1200,
    alt: "A look",
    photographer: "Ada",
    photographerUrl: "https://www.pexels.com/@ada",
    pexelsUrl: "https://www.pexels.com/photo/7/",
    imageUrl: "https://images.pexels.com/7-large.jpg",
  };

  it("accepts a full pin, and root-relative mock images", () => {
    expect(validatePinBody(good)).toEqual({ ok: true, value: good });
    expect(validatePinBody({ ...good, imageUrl: "/fixtures/pin-1.svg" }).ok).toBe(true);
  });

  it("rejects bad ids, dimensions, and image urls", () => {
    expect(validatePinBody(null).ok).toBe(false);
    expect(validatePinBody({ ...good, pexelsId: "7" }).ok).toBe(false);
    expect(validatePinBody({ ...good, width: 0 }).ok).toBe(false);
    expect(validatePinBody({ ...good, imageUrl: "http://insecure.example/x.jpg" }).ok).toBe(false);
    expect(validatePinBody({ ...good, imageUrl: "//evil.example/x.jpg" }).ok).toBe(false);
  });

  it("blanks non-https credit links instead of failing", () => {
    const r = validatePinBody({ ...good, photographerUrl: "javascript:alert(1)" });
    expect(r.ok && r.value.photographerUrl).toBe("");
  });
});
