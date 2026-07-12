import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test("lookbook starts empty with a studio CTA", async ({ page }) => {
  await unlock(page);
  await page.goto("/lookbook");
  await expect(page.getByText("No looks yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Studio" })).toBeVisible();
});
