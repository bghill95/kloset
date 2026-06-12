import { expect, test, type Page } from "@playwright/test";

const PASSCODE = "test-1234";

async function unlock(page: Page) {
  await page.goto("/login");
  if (page.url().endsWith("/setup")) {
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByLabel("Confirm passcode").fill(PASSCODE);
    await page.getByRole("button", { name: "Create passcode" }).click();
  } else {
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByRole("button", { name: "Unlock" }).click();
  }
  await expect(page).toHaveURL(/\/closet$/);
}

test.describe.serial("closet", () => {
  test("empty closet shows the scan tile and empty state", async ({ page }) => {
    await unlock(page);
    await expect(page.getByText("Your closet is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: /Scan item/ })).toBeVisible();
  });
});
