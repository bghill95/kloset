import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test.describe.serial("context status bar", () => {
  test("status bar shows fixture weather and events on closet", async ({
    page,
  }) => {
    await unlock(page);
    const bar = page.getByRole("link", {
      name: /weather and events/i,
    });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("18–24°");
    await expect(bar).toContainText("Coffee with Sam");
  });

  test("tapping the bar opens settings", async ({ page }) => {
    await unlock(page);
    await page
      .getByRole("link", { name: /weather and events/i })
      .click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("calendar save & test connects in mock mode", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await page
      .getByLabel("Calendar link")
      .fill("webcal://p01-caldav.icloud.com/published/2/test");
    await page.getByRole("button", { name: "Save & test" }).click();
    await expect(page.locator("p[role='status']")).toContainText("Connected");
    await expect(page.getByText("✅ Calendar connected")).toBeVisible();
  });

  test("weather location sets and clears", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await page.getByLabel("City").fill("Carlsbad");
    await page.getByRole("button", { name: "Set location" }).click();
    await expect(page.getByText("Weather location: Mock City")).toBeVisible();
    await page
      .getByRole("button", { name: "Remove" })
      .last()
      .click();
    await expect(page.getByLabel("City")).toBeVisible();
  });

  test("calendar removes cleanly", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByLabel("Calendar link")).toBeVisible();
  });
});
