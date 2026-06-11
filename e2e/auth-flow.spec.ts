import { expect, test } from "@playwright/test";

const PASSCODE = "test-1234";

test.describe.serial("first-run auth flow", () => {
  test("unauthenticated visit is sent to setup via login", async ({ page }) => {
    await page.goto("/closet");
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("creating a passcode unlocks the app", async ({ page }) => {
    await page.goto("/setup");
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByLabel("Confirm passcode").fill(PASSCODE);
    await page.getByRole("button", { name: "Create passcode" }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await expect(page.getByRole("heading", { name: "Closet" })).toBeVisible();
  });

  test("wrong passcode is rejected, correct one unlocks", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Passcode", { exact: true }).fill("wrong-passcode");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.locator("p[role='alert']")).toContainText("Wrong passcode");

    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page).toHaveURL(/\/closet$/);
  });

  test("session persists across reload", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Closet" })).toBeVisible();
  });
});

test("malformed login body returns 400, not 500", async ({ request }) => {
  const res = await request.post("/api/auth/login", {
    headers: { "Content-Type": "application/json" },
    data: "",
  });
  expect(res.status()).toBe(400);
});
