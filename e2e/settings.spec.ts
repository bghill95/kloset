import path from "node:path";
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test.describe.serial("avatar base photos", () => {
  test("avatar section starts empty with capture entry", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await expect(page.getByText("Base photos are what outfits")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Capture base photo/ }),
    ).toBeVisible();
  });

  test("take photo now → preview → use photo lands in settings as primary", async ({
    page,
  }) => {
    await unlock(page);
    await page.goto("/avatar-capture");
    await expect(page.getByTestId("outline-body")).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
    await page.getByRole("button", { name: "Take photo now" }).click();
    await page.getByRole("button", { name: "Use photo" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText("Primary", { exact: true })).toBeVisible();
  });

  test("retake returns to a live viewfinder", async ({ page }) => {
    await unlock(page);
    await page.goto("/avatar-capture");
    await page.getByRole("button", { name: "Take photo now" }).click();
    await expect(page.getByRole("button", { name: "↻ Retake" })).toBeVisible();
    await page.getByRole("button", { name: "↻ Retake" }).click();
    await expect(page.getByTestId("outline-body")).toBeVisible();
    // The re-acquired stream must re-enable the shutter (regression: black
    // viewfinder with dead buttons after retake).
    await expect(
      page.getByRole("button", { name: "Take photo now" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "✕ Cancel" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("library photo becomes second; make primary flips the badge", async ({
    page,
  }) => {
    await unlock(page);
    await page.goto("/avatar-capture");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(__dirname, "fixtures", "garment.svg"));
    await page.getByRole("button", { name: "Use photo" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText("Primary", { exact: true })).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Make primary" }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Make primary" }).click();
    // Badge moves; there is still exactly one of each.
    await expect(page.getByText("Primary", { exact: true })).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Make primary" }),
    ).toHaveCount(1);
  });

  test("countdown overlay shows and cancels", async ({ page }) => {
    await unlock(page);
    await page.goto("/avatar-capture");
    await page.getByRole("button", { name: /10s timer/ }).click();
    await expect(page.getByTestId("countdown-overlay")).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch camera" })).toBeDisabled();
    await page.getByTestId("countdown-overlay").click();
    await expect(page.getByTestId("countdown-overlay")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Take photo now" }),
    ).toBeEnabled();
  });

  test("deleting both photos returns to the empty state", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(1);
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByRole("link", { name: /Capture base photo/ }),
    ).toBeVisible();
  });
});
