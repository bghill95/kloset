import { expect, type Page } from "@playwright/test";

export const PASSCODE = "test-1234";

export async function unlock(page: Page) {
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
