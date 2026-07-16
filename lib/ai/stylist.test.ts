import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import {
  closetCanDress,
  mockCombos,
  stylistPrompt,
  suggestOutfits,
  validateCombos,
  validateStylistBody,
} from "./stylist";

function item(id: string, category: Category, name = id): ClosetItem {
  return {
    id,
    name,
    category,
    colors: ["blue"],
    styleTags: [],
    imageUrl: `/i/${id}.png`,
    originalImageUrl: `/o/${id}.png`,
    createdAt: new Date(0),
  };
}

const CLOSET = [item("t1", "top"), item("t2", "top"), item("b1", "bottom"), item("s1", "shoes")];

describe("closetCanDress", () => {
  it("needs a dress, or a top and a bottom", () => {
    expect(closetCanDress(CLOSET)).toBe(true);
    expect(closetCanDress([item("d1", "dress")])).toBe(true);
    expect(closetCanDress([item("t1", "top"), item("s1", "shoes")])).toBe(false);
    expect(closetCanDress([])).toBe(false);
  });
});

describe("validateCombos", () => {
  const good = { name: "Look", reason: "why", itemIds: ["t1", "b1"] };

  it("keeps valid combos and trims text", () => {
    const combos = validateCombos(
      { outfits: [{ ...good, name: `  ${"x".repeat(200)}  ` }] },
      CLOSET,
    );
    expect(combos).toHaveLength(1);
    expect(combos[0].name.length).toBeLessThanOrEqual(120);
    expect(combos[0].itemIds).toEqual(["t1", "b1"]);
  });

  it("drops combos with hallucinated ids", () => {
    expect(validateCombos({ outfits: [{ ...good, itemIds: ["t1", "ghost"] }] }, CLOSET)).toEqual([]);
  });

  it("drops duplicate-category and unwearable combos", () => {
    expect(validateCombos({ outfits: [{ ...good, itemIds: ["t1", "t2"] }] }, CLOSET)).toEqual([]);
    expect(validateCombos({ outfits: [{ ...good, itemIds: ["s1"] }] }, CLOSET)).toEqual([]);
  });

  it("returns [] for malformed payloads", () => {
    expect(validateCombos(null, CLOSET)).toEqual([]);
    expect(validateCombos({ outfits: "no" }, CLOSET)).toEqual([]);
  });
});

describe("mockCombos", () => {
  it("is deterministic and wearable", () => {
    const a = mockCombos(CLOSET, 6);
    const b = mockCombos(CLOSET, 6);
    expect(a).toEqual(b);
    expect(a).toHaveLength(6);
    expect(a[0].itemIds).toEqual(["t1", "b1", "s1"]);
    expect(a[1].itemIds).toEqual(["t2", "b1", "s1"]);
    expect(a[0].name).toBe("Mock look 1");
  });

  it("falls back to dresses and stops when nothing is wearable", () => {
    expect(mockCombos([item("d1", "dress")], 2)).toHaveLength(2);
    expect(mockCombos([item("s1", "shoes")], 3)).toEqual([]);
  });
});

describe("suggestOutfits with MOCK_AI=1", () => {
  const previous = process.env.MOCK_AI;
  beforeEach(() => {
    process.env.MOCK_AI = "1";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.MOCK_AI;
    else process.env.MOCK_AI = previous;
  });

  it("returns mock combos without touching OpenAI", async () => {
    const combos = await suggestOutfits(CLOSET, { count: 3 });
    expect(combos).toEqual(mockCombos(CLOSET, 3));
  });

  it("returns [] when the closet can't dress", async () => {
    expect(await suggestOutfits([item("s1", "shoes")], { count: 3 })).toEqual([]);
  });
});

describe("validateStylistBody", () => {
  it("defaults count to 6", () => {
    const r = validateStylistBody({});
    expect(r.ok && r.value).toEqual({ count: 6, occasion: undefined, date: undefined });
  });

  it("accepts occasion + date, trimming the occasion", () => {
    const r = validateStylistBody({ count: 3, occasion: "  interview ", date: "2026-07-18" });
    expect(r.ok && r.value).toEqual({ count: 3, occasion: "interview", date: "2026-07-18" });
  });

  it("treats an empty occasion as absent", () => {
    const r = validateStylistBody({ occasion: "   " });
    expect(r.ok && r.value.occasion).toBeUndefined();
  });

  it("rejects bad counts and dates", () => {
    expect(validateStylistBody({ count: 0 }).ok).toBe(false);
    expect(validateStylistBody({ count: 11 }).ok).toBe(false);
    expect(validateStylistBody({ count: 2.5 }).ok).toBe(false);
    expect(validateStylistBody({ date: "next friday" }).ok).toBe(false);
    expect(validateStylistBody(null).ok).toBe(false);
  });
});

describe("stylistPrompt", () => {
  const promptItem = (id: string, category: Category, tags: string[]): ClosetItem => ({
    id,
    name: `Item ${id}`,
    category,
    colors: ["black"],
    styleTags: tags,
    imageUrl: "/x.svg",
    originalImageUrl: "/x.svg",
    createdAt: new Date("2026-01-01"),
  });
  const items = [promptItem("id-1", "top", ["minimalist"]), promptItem("id-2", "bottom", [])];
  const prefs = {
    scores: { "id-1": { likes: 2, dislikes: 1 } },
    profile: { likedTags: ["minimalist"], dislikedTags: ["neon"], likedColors: [], dislikedColors: [] },
  };

  it("flags feedback inline and adds taste lines", () => {
    const prompt = stylistPrompt(items, { count: 3, prefs });
    expect(prompt).toContain("id-1 | top | Item id-1");
    expect(prompt).toContain("feedback: liked 2×, disliked 1×");
    expect(prompt).toContain("Her feedback says she likes: minimalist.");
    expect(prompt).toContain("Her feedback says to avoid: neon.");
    expect(prompt).toContain("Honor the feedback signals");
  });

  it("omits feedback plumbing without prefs", () => {
    const prompt = stylistPrompt(items, { count: 3 });
    expect(prompt).not.toContain("feedback:");
    expect(prompt).not.toContain("Honor the feedback signals");
  });
});
