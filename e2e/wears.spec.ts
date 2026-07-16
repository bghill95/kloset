import { expect, test } from "@playwright/test";

// Seeds its own items/outfit/wear via the API — no dependence on leftovers.
// NOTE: retries must stay 0 for this serial suite — a retry re-runs the seed.
test.describe.serial("wear history", () => {
  let outfitId: string;

  test("seed: outfit saved and worn via the API", async ({ page }) => {
    const ids: string[] = [];
    for (const [name, category] of [
      ["Wear-test tee", "top"],
      ["Wear-test jeans", "bottom"],
    ] as const) {
      const res = await page.request.post("/api/items", {
        data: {
          name,
          category,
          colors: ["red"],
          styleTags: [],
          imageUrl: "/fixtures/cutout-top.svg",
          originalImageUrl: "/fixtures/original-top.svg",
        },
      });
      expect(res.status()).toBe(201);
      ids.push((await res.json()).item.id);
    }
    const outfitRes = await page.request.post("/api/outfits", {
      data: { name: "Wear-test look", itemIds: ids, renderUrl: null, source: "stylist" },
    });
    expect(outfitRes.status()).toBe(201);
    outfitId = (await outfitRes.json()).outfit.id;
    const wearRes = await page.request.post("/api/wears", {
      data: { outfitId, wornOn: "2026-07-01" },
    });
    expect(wearRes.status()).toBe(200);
    expect((await wearRes.json()).worn).toBe(true);
  });

  test("lookbook shows the badge; detail shows history and actions", async ({ page }) => {
    await page.goto("/lookbook");
    const card = page.getByRole("link", { name: /Wear-test look/ });
    await expect(card.getByText("Worn 1×")).toBeVisible();
    await card.click();
    await expect(page.getByRole("heading", { level: 1, name: "Wear-test look" })).toBeVisible();
    await expect(
      page.getByLabel("Wear history").getByRole("heading", { name: "Worn 1×" }),
    ).toBeVisible();
    await expect(page.getByText("Wednesday, July 1, 2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wearing this today" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open in Studio" })).toBeVisible();
    // Pieces link back to the closet.
    await expect(
      page.getByLabel("Pieces").getByRole("link", { name: /Wear-test tee/ }),
    ).toBeVisible();
  });

  test("deleting the outfit removes it and its wears", async ({ page }) => {
    await page.goto(`/lookbook/${outfitId}`);
    await page.getByRole("button", { name: "Delete outfit" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/lookbook$/);
    await expect(page.getByRole("link", { name: /Wear-test look/ })).toHaveCount(0);
    // The delete route sweeps orphan wears (no FK) — verify via the API.
    const swept = await page.request.get("/api/wears?on=2026-07-01");
    expect((await swept.json()).wears).toEqual([]);
  });
});
