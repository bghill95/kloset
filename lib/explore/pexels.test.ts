// lib/explore/pexels.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockPins, parsePexelsResponse, searchPexels } from "./pexels";

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

describe("searchPexels", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("serves mock pins under MOCK_AI=1 when no key is set", async () => {
    vi.stubEnv("MOCK_AI", "1");
    vi.stubEnv("PEXELS_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { pins } = await searchPexels("boho outfit", 1, 4);
    expect(pins[0].imageUrl).toMatch(/^\/fixtures\/pin-\d\.svg$/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the real API when a key is set, even under MOCK_AI=1", async () => {
    vi.stubEnv("MOCK_AI", "1");
    vi.stubEnv("PEXELS_API_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await searchPexels("boho outfit", 1, 4);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe("test-key");
  });

  it("biases every real query toward women's fashion", async () => {
    vi.stubEnv("MOCK_AI", "0");
    vi.stubEnv("PEXELS_API_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await searchPexels("street style fashion", 1, 4);
    expect(fetchSpy.mock.calls[0][0]).toContain(
      encodeURIComponent("women street style fashion"),
    );
  });
});

describe("parsePexelsResponse credit links", () => {
  it("blanks non-https photographer and pexels urls", () => {
    const { pins } = parsePexelsResponse({
      photos: [photo(9, { photographer_url: "http://insecure.example", url: "javascript:alert(1)" })],
    });
    expect(pins[0].photographerUrl).toBe("");
    expect(pins[0].pexelsUrl).toBe("");
  });
});

describe("searchPexels", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns canned pins under MOCK_AI without a key", async () => {
    vi.stubEnv("MOCK_AI", "1");
    vi.stubEnv("PEXELS_API_KEY", "");
    await expect(searchPexels("boho", 1, 4)).resolves.toEqual({
      pins: mockPins("boho", 1, 4),
      hasMore: true,
    });
  });

  it("throws without a key when not mocked", async () => {
    vi.stubEnv("MOCK_AI", "0");
    vi.stubEnv("PEXELS_API_KEY", "");
    await expect(searchPexels("boho", 1, 4)).rejects.toThrow("PEXELS_API_KEY");
  });

  it("throws on a non-OK response", async () => {
    vi.stubEnv("MOCK_AI", "0");
    vi.stubEnv("PEXELS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 })));
    await expect(searchPexels("boho", 1, 4)).rejects.toThrow("429");
  });
});
