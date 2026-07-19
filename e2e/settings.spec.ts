import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe.serial("avatar base photos", () => {
  test("avatar section starts empty with capture entry", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Base photos are what outfits")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Capture base photo/ }),
    ).toBeVisible();
  });

  test("take photo now → preview → use photo lands in settings as primary", async ({
    page,
  }) => {
    await page.goto("/avatar-capture");
    await expect(page.getByTestId("outline-body")).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
    await page.getByRole("button", { name: "Take photo now" }).click();
    await page.getByRole("button", { name: "Use photo" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText("Primary", { exact: true })).toBeVisible();
  });

  test("retake returns to a live viewfinder", async ({ page }) => {
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

test.describe.serial("calendar and weather settings flows", () => {
  test("calendar save & test connects in mock mode", async ({ page }) => {
    await page.goto("/settings");
    await page
      .getByLabel("Calendar link")
      .fill("webcal://p01-caldav.icloud.com/published/2/test");
    await page.getByRole("button", { name: "Save & test" }).click();
    await expect(page.locator("p[role='status']")).toContainText("Connected");
    await expect(page.getByText("✅ Calendar connected")).toBeVisible();
  });

  test("weather location sets and clears", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("City").fill("Carlsbad");
    await page.getByRole("button", { name: "Set location" }).click();
    await expect(page.getByText("Weather location: Mock City")).toBeVisible();
    await page
      .locator("section[aria-label='Weather']")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(page.getByLabel("City")).toBeVisible();
  });

  test("calendar removes cleanly", async ({ page }) => {
    await page.goto("/settings");
    await page
      .locator("section[aria-label='Calendar']")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(page.getByLabel("Calendar link")).toBeVisible();
  });
});

test.describe.serial("pinterest settings", () => {
  test("mock mode is connected; boards default-selected; save & sync reports count", async ({ page }) => {
    await page.goto("/settings");
    const section = page.locator("section[aria-label='Pinterest']");
    await expect(section.getByText("✅ Pinterest connected")).toBeVisible();
    // Mock boards arrive pre-selected (default selection = all mock boards).
    await expect(section.getByRole("checkbox", { name: "Street Style" })).toBeChecked();
    await expect(section.getByRole("checkbox", { name: "Parisian Chic" })).toBeChecked();
    await section.getByRole("button", { name: "Save boards & sync" }).click();
    // 2 boards × 45 mock pins, deduped — keeps both boards selected so
    // z-explore's 90-pin feed assumptions hold (specs share one DB wipe).
    await expect(section.getByText("Synced 90 pins.")).toBeVisible();
  });
});

test("studio credit signs the foot of the page", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("built by Pseudo Engineering Studios")).toBeVisible();
});
