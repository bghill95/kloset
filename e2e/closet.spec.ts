import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test.describe.serial("closet", () => {
  test("empty closet shows the scan tile and empty state", async ({ page }) => {
    await unlock(page);
    await expect(page.getByText("Your closet is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: /Scan item/ })).toBeVisible();
  });
});
