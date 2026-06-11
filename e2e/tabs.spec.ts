import { expect, test } from "@playwright/test";

const PASSCODE = "test-1234";

async function unlock(page: import("@playwright/test").Page) {
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

test("health endpoint reports db connectivity without auth", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: true });
});

test("tab bar navigates between all five screens", async ({ page }) => {
  await unlock(page);
  for (const name of ["Studio", "Stylist", "Lookbook", "Settings", "Closet"]) {
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
});
