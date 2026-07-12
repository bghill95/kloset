import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

// Runs after settings.spec (base photos: zero) and closet.spec (one leftover
// top). Seeds its own items; Task 8's tests seed the base photo late so the
// no-base-photo path stays testable.
test.describe.serial("studio", () => {
  test("seed: three items land in the closet via the API", async ({ page }) => {
    await unlock(page);
    for (const [name, category] of [
      ["Studio tee", "top"],
      ["Studio jeans", "bottom"],
      ["Studio sneakers", "shoes"],
    ] as const) {
      const res = await page.request.post("/api/items", {
        data: {
          name,
          category,
          colors: ["blue"],
          styleTags: [],
          imageUrl: "/fixtures/cutout-top.svg",
          originalImageUrl: "/fixtures/original-top.svg",
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  test("selecting pieces composes the flat-lay collage", async ({ page }) => {
    await unlock(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(1);
    await page.getByRole("button", { name: "Bottoms" }).click();
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(2);
    // Tapping the selected piece again clears its slot.
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(1);
  });
});
