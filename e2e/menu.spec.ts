import { expect, test } from "@playwright/test";

test("health endpoint reports db connectivity without auth", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: true });
});

test("full-screen menu navigates between all seven screens", async ({ page }) => {
  await page.goto("/today");
  for (const name of ["Closet", "Studio", "Stylist", "Explore", "Lookbook", "Settings", "Today"]) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("menu closes on Escape without navigating", async ({ page }) => {
  await page.goto("/today");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  await expect(page).toHaveURL(/\/today$/);
});

test("Tab is trapped inside the open menu", async ({ page }) => {
  await page.goto("/today");
  await page.getByRole("button", { name: "Open menu" }).click();
  // Focus starts on the close button; Shift+Tab must wrap to the last link.
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
});

test("PWA manifest and icons are served without auth", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body.name).toBe("Kloset");
  expect(body.display).toBe("standalone");
  const icon = await request.get("/icon");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
  const appleIcon = await request.get("/apple-icon");
  expect(appleIcon.status()).toBe(200);
  expect(appleIcon.headers()["content-type"]).toContain("image/png");
});
