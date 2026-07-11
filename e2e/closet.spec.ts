import path from "node:path";
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test.describe.serial("closet", () => {
  test("empty closet shows the scan tile and empty state", async ({ page }) => {
    await unlock(page);
    await page.goto("/closet");
    await expect(page.getByText("Your closet awaits")).toBeVisible();
    await expect(page.getByRole("link", { name: /Scan item/ })).toBeVisible();
  });

  test("viewfinder renders with the category outline", async ({ page }) => {
    await unlock(page);
    await page.goto("/scan");
    await expect(page.getByTestId("outline-top")).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
    await page.getByRole("radio", { name: "Shoes" }).click();
    await expect(page.getByTestId("outline-shoes")).toBeVisible();
  });

  test("scan via library: ingest, confirm, save, appears in grid", async ({
    page,
  }) => {
    await unlock(page);
    await page.goto("/scan");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(__dirname, "fixtures", "garment.svg"));
    // Mock pipeline fills the sheet with the fixture suggestion.
    await expect(page.getByLabel("Name")).toHaveValue(
      "Light blue oxford shirt",
      { timeout: 15_000 },
    );
    await page.getByLabel("Name").fill("My test shirt");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await expect(page.getByText("My test shirt")).toBeVisible();
  });

  test("save & scan another returns to the camera", async ({ page }) => {
    await unlock(page);
    await page.goto("/scan");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(__dirname, "fixtures", "garment.svg"));
    await expect(page.getByLabel("Name")).toHaveValue(
      "Light blue oxford shirt",
      { timeout: 15_000 },
    );
    await page
      .getByRole("button", { name: "Save & scan another" })
      .click();
    await expect(page.getByTestId("outline-top")).toBeVisible();
  });

  test("category filter narrows the grid", async ({ page }) => {
    await unlock(page);
    await page.goto("/closet?category=shoes");
    await expect(page.getByText("My test shirt")).not.toBeVisible();
    await page.goto("/closet?category=top");
    await expect(page.getByText("My test shirt")).toBeVisible();
  });

  test("item detail edits persist", async ({ page }) => {
    await unlock(page);
    await page.goto("/closet");
    await page.getByRole("link", { name: /My test shirt/ }).click();
    await expect(page.getByLabel("Name")).toHaveValue("My test shirt");
    await page.getByLabel("Name").fill("Renamed shirt");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("p[role='status']")).toContainText("Saved");
    await page.goto("/closet");
    await expect(page.getByText("Renamed shirt")).toBeVisible();
  });

  test("deleting an item removes it from the grid", async ({ page }) => {
    await unlock(page);
    await page.goto("/closet");
    await page.getByRole("link", { name: /Renamed shirt/ }).click();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete item" }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await expect(page.getByText("Renamed shirt")).not.toBeVisible();
  });

  // NOTE: this suite intentionally leaves one item ("Light blue oxford shirt",
  // from the save-&-scan-another test) in the DB. Specs sorting after
  // closet.spec.ts inherit it; the per-run wipe in global-setup resets it.
});
