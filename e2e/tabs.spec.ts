import { expect, test } from "@playwright/test";

test("root redirects to closet", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/closet$/);
  await expect(page.getByRole("heading", { name: "Closet" })).toBeVisible();
});

test("tab bar navigates between all five screens", async ({ page }) => {
  await page.goto("/closet");
  for (const name of ["Studio", "Stylist", "Lookbook", "Settings", "Closet"]) {
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
});

test("health endpoint reports db connectivity", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: true });
});
