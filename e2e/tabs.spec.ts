import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

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

test("PWA manifest and icons are served without auth", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body.display).toBe("standalone");

  const icon = await request.get("/icon");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");

  const appleIcon = await request.get("/apple-icon");
  expect(appleIcon.status()).toBe(200);
  expect(appleIcon.headers()["content-type"]).toContain("image/png");
});
