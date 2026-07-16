import { expect, test } from "@playwright/test";

// Named z-trips to run after studio.spec's seeds (the mock capsule needs
// closet items) and after z-explore/z-prefs (e < p < t).
// NOTE: retries must stay 0 — the serial suite assumes its own seeds.
function key(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

test.describe.serial("trips", () => {
  test("create a trip and land on its detail", async ({ page }) => {
    await page.goto("/trips");
    await expect(page.getByRole("heading", { level: 1, name: "Trips" })).toBeVisible();
    await expect(page.getByText("No trips planned yet — add one above.")).toBeVisible();
    await page.getByLabel("Destination").fill("Paris");
    await page.getByLabel("First day").fill(key(2));
    await page.getByLabel("Last day").fill(key(5));
    await page.getByRole("button", { name: "Add trip" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Paris" })).toBeVisible();
    // Within the 16-day horizon → mock forecast strip renders.
    await expect(page.getByLabel("Trip forecast")).toBeVisible();
  });

  test("generate capsule, tick an item, ticks survive reload and regenerate", async ({ page }) => {
    await page.goto("/trips");
    await page.getByRole("link", { name: /Paris/ }).click();
    await page.getByRole("button", { name: "Generate packing list" }).click();
    await expect(page.getByTestId("capsule-item").first()).toBeVisible();

    const firstBox = page.getByTestId("capsule-item").first().getByRole("checkbox");
    // Wait for the PATCH to land before reloading — the tick is optimistic in
    // the UI, and reload() would otherwise cancel the still-in-flight request.
    const patched = page.waitForResponse(
      (res) => res.request().method() === "PATCH" && res.url().includes("/api/trips/"),
    );
    await firstBox.check();
    await expect(firstBox).toBeChecked();
    await patched;

    await page.reload();
    await expect(
      page.getByTestId("capsule-item").first().getByRole("checkbox"),
    ).toBeChecked();

    // Regenerate keeps the tick — the mock capsule is deterministic.
    const regenerated = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/capsule"),
    );
    await page.getByRole("button", { name: "Regenerate capsule" }).click();
    await regenerated;
    await expect(page.getByText(/1\/\d+ packed/)).toBeVisible();
    await expect(
      page.getByTestId("capsule-item").first().getByRole("checkbox"),
    ).toBeChecked();
  });

  test("delete removes the trip", async ({ page }) => {
    await page.goto("/trips");
    await page.getByRole("link", { name: /Paris/ }).click();
    await page.getByRole("button", { name: "Delete trip" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.getByText("No trips planned yet — add one above.")).toBeVisible();
  });
});
