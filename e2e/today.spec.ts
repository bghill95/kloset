import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test("today shows heading, date, and fixture weather", async ({ page }) => {
  await unlock(page); // lands on /today
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  // MOCK_AI fixture weather renders as a labeled chip.
  await expect(page.getByLabel("Today's weather")).toBeVisible();
  // Either an outfit or the empty-closet CTA is present.
  await expect(
    page.getByLabel("Today's outfit").or(page.getByRole("link", { name: "Scan your first item" })),
  ).toBeVisible();
});
