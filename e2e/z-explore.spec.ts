import { expect, test } from "@playwright/test";

// Named z- to run LAST: by now studio.spec's tee/jeans/sneakers are seeded,
// so MOCK_AI stylist combos work for the "Style this" flow.
// NOTE: retries must stay 0 — the save-toggle test assumes a clean pins table.
test.describe.serial("explore", () => {
  test("feed renders a masonry of mock pins", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
    await expect(page.getByTestId("pin-card")).toHaveCount(30);
  });

  test("infinite scroll loads a second page", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByTestId("pin-card")).toHaveCount(30);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId("pin-card")).toHaveCount(60);
  });

  test("search swaps the feed to the query", async ({ page }) => {
    await page.goto("/explore");
    await page.getByLabel("Search inspiration").fill("parisian chic");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator('img[alt="Mock pin parisian chic 1"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "“parisian chic”" })).toBeVisible();
  });

  test("lightbox shows credit and styles the look from the closet", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("button", { name: /^Open pin/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Pin detail" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Pexels" })).toBeVisible();
    await dialog.getByRole("button", { name: "Style this from my closet" }).click();
    await expect(dialog.getByTestId("suggestion-card").first()).toBeVisible();
    await expect(dialog.getByText("Mock look 1")).toBeVisible();
  });

  test("heart toggle saves, persists, and unsaves a pin", async ({ page }) => {
    await page.goto("/explore");
    await page.getByLabel("Save pin").first().click();
    await expect(page.getByLabel("Unsave pin").first()).toBeVisible();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.getByTestId("saved-grid").getByTestId("pin-card")).toHaveCount(1);
    // Survives a reload — it lives in the database, not component state.
    await page.reload();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.getByTestId("saved-grid").getByTestId("pin-card")).toHaveCount(1);
    await page.getByTestId("saved-grid").getByLabel("Unsave pin").click();
    await expect(page.getByText("Nothing pinned yet")).toBeVisible();
  });
});
