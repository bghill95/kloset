import { expect, test } from "@playwright/test";

// Runs after studio.spec (alphabetical), so the closet already holds the
// studio seed items (tee/jeans/sneakers) plus closet.spec's leftover top —
// enough for MOCK_AI's deterministic combos ("Mock look N").
test.describe.serial("stylist", () => {
  test("inspiration feed renders mock combos with actions", async ({ page }) => {
    await page.goto("/stylist");
    await expect(page.getByRole("heading", { level: 1, name: "Stylist" })).toBeVisible();
    const first = page.getByTestId("suggestion-card").first();
    await expect(first).toBeVisible();
    await expect(first.getByText("Mock look 1")).toBeVisible();
    await expect(first.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    await expect(first.getByRole("button", { name: "Wearing this today" })).toBeVisible();
    await expect(first.getByRole("link", { name: "Open in Studio" })).toBeVisible();
  });

  test("occasion prompt returns dated looks", async ({ page }) => {
    await page.goto("/stylist");
    await page.getByLabel("Style an occasion").fill("Interview");
    await page.getByRole("button", { name: "Style me" }).click();
    await expect(page.getByRole("heading", { name: "For the occasion" })).toBeVisible();
    await expect(
      page.getByLabel("Occasion looks").getByTestId("suggestion-card").first(),
    ).toBeVisible();
  });

  test("open in studio preloads the combo", async ({ page }) => {
    await page.goto("/stylist");
    const first = page.getByTestId("suggestion-card").first();
    await first.getByRole("link", { name: "Open in Studio" }).click();
    await expect(page).toHaveURL(/\/studio\?items=/);
    // Mock look 1 = top + bottom + shoes → three preloaded collage layers.
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(3);
  });

  test("saving a suggestion lands it in the lookbook", async ({ page }) => {
    await page.goto("/stylist");
    const first = page.getByTestId("suggestion-card").first();
    await first.getByRole("button", { name: "Save", exact: true }).click();
    await expect(first.getByRole("button", { name: "Saved ✓" })).toBeDisabled();
    await page.goto("/lookbook");
    await expect(page.getByText("Mock look 1").first()).toBeVisible();
  });

  test("gaps card suggests additions below the feed", async ({ page }) => {
    await page.goto("/stylist");
    await expect(page.getByRole("heading", { name: "More outfits if you add" })).toBeVisible();
    await expect(page.getByTestId("gap-suggestion").first()).toBeVisible();
  });
});
