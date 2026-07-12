import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

// Runs after settings.spec (base photos: zero) and closet.spec (one leftover
// top). Seeds its own items; Task 8's tests seed the base photo late so the
// no-base-photo path stays testable.
// NOTE: retries must stay 0 for this serial suite — a retry re-runs the seed test and duplicates items.
test.describe.serial("studio", () => {
  test("seed: three items land in the closet via the API", async ({ page }) => {
    await unlock(page);
    for (const [name, category] of [
      ["Studio tee", "top"],
      ["Studio jeans", "bottom"],
      ["Studio sneakers", "shoes"],
    ] as const) {
      const res = await page.request.post("/api/items", {
        data: {
          name,
          category,
          colors: ["blue"],
          styleTags: [],
          imageUrl: "/fixtures/cutout-top.svg",
          originalImageUrl: "/fixtures/original-top.svg",
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  test("selecting pieces composes the flat-lay collage", async ({ page }) => {
    await unlock(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(1);
    await page.getByRole("button", { name: "Bottoms" }).click();
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(2);
    // Tapping the selected piece again clears its slot.
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(1);
  });

  test("save outfit lands in the lookbook", async ({ page }) => {
    await unlock(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await page.getByRole("button", { name: "Bottoms" }).click();
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await page.getByRole("button", { name: "Save outfit" }).click();
    await expect(page.getByLabel("Outfit name")).toHaveValue("Studio tee + Studio jeans");
    await page.getByLabel("Outfit name").fill("Friday fit");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/lookbook$/);
    await expect(page.getByText("Friday fit")).toBeVisible();
  });

  test("try it on without a base photo points to avatar capture", async ({ page }) => {
    await unlock(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await page.getByRole("button", { name: "Try it on" }).click();
    // Next 16's route announcer also has role=alert — use the precise locator.
    await expect(page.locator("p[role='alert']")).toContainText("base photo");
    await expect(page.getByRole("link", { name: "Capture base photo" })).toBeVisible();
  });

  test("try it on renders the mock try-on photo", async ({ page }) => {
    await unlock(page);
    const seeded = await page.request.post("/api/base-photos", {
      multipart: {
        photo: { name: "base.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg-bytes") },
      },
    });
    expect(seeded.status()).toBe(201);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await page.getByRole("button", { name: "Try it on" }).click();
    const photo = page.getByRole("img", { name: "Try-on render" });
    await expect(photo).toBeVisible({ timeout: 15_000 });
    await expect(photo).toHaveAttribute("src", /render\.svg/);
    // Flip back to the flat lay and back again.
    await page.getByRole("button", { name: "Flat lay" }).click();
    await expect(page.getByTestId("outfit-collage")).toBeVisible();
    await page.getByRole("button", { name: "Try-on", exact: true }).click();
    await expect(photo).toBeVisible();
  });
});
