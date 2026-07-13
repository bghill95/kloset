// lib/explore/pexels.test.ts
import { describe, expect, it } from "vitest";
import { mockPins, parsePexelsResponse } from "./pexels";

const photo = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  width: 800,
  height: 1200,
  url: `https://www.pexels.com/photo/${id}/`,
  photographer: "Ada",
  photographer_url: "https://www.pexels.com/@ada",
  alt: "A look",
  src: { large: `https://images.pexels.com/${id}-large.jpg` },
  ...over,
});

describe("parsePexelsResponse", () => {
  it("maps photos to pins and reads next_page as hasMore", () => {
    const { pins, hasMore } = parsePexelsResponse({
      photos: [photo(7)],
      next_page: "https://api.pexels.com/v1/search?page=2",
    });
    expect(pins).toEqual([
      {
        pexelsId: 7,
        width: 800,
        height: 1200,
        alt: "A look",
        photographer: "Ada",
        photographerUrl: "https://www.pexels.com/@ada",
        pexelsUrl: "https://www.pexels.com/photo/7/",
        imageUrl: "https://images.pexels.com/7-large.jpg",
      },
    ]);
    expect(hasMore).toBe(true);
  });

  it("drops malformed entries and reports hasMore=false without next_page", () => {
    const { pins, hasMore } = parsePexelsResponse({
      photos: [photo(1, { src: {} }), photo(2, { id: "nope" }), "junk", photo(3)],
    });
    expect(pins.map((p) => p.pexelsId)).toEqual([3]);
    expect(hasMore).toBe(false);
  });

  it("returns empty on garbage input", () => {
    expect(parsePexelsResponse(null)).toEqual({ pins: [], hasMore: false });
  });
});

describe("mockPins", () => {
  it("is deterministic, sized to perPage, and unique across pages and queries", () => {
    const a = mockPins("boho outfit", 1, 30);
    expect(mockPins("boho outfit", 1, 30)).toEqual(a);
    expect(a).toHaveLength(30);
    const b = mockPins("boho outfit", 2, 30);
    const other = mockPins("grunge outfit", 1, 30);
    const ids = new Set([...a, ...b, ...other].map((p) => p.pexelsId));
    expect(ids.size).toBe(90);
  });

  it("serves root-relative fixture images with positive dimensions and query-tagged alt", () => {
    const [first] = mockPins("parisian chic", 1, 4);
    expect(first.imageUrl).toMatch(/^\/fixtures\/pin-\d\.svg$/);
    expect(first.width).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(0);
    expect(first.alt).toBe("Mock pin parisian chic 1");
  });
});
