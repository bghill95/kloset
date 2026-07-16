// e2e/z-prefs.spec.ts
import { expect, test } from "@playwright/test";

// Named z-prefs to run after studio.spec's seeds (tee/jeans/sneakers) so
// MOCK_AI stylist combos exist. Runs after z-explore (e < p).
test.describe.serial("preferences", () => {
  test("thumbs toggle, persist across reload, and flip", async ({ page }) => {
    await page.goto("/stylist");
    const card = page.getByTestId("suggestion-card").first();
    const like = card.getByRole("button", { name: "Like this outfit", exact: true });
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");

    // Survives a reload — feed restores from sessionStorage, vote from the DB.
    await page.reload();
    const cardAfter = page.getByTestId("suggestion-card").first();
    await expect(
      cardAfter.getByRole("button", { name: "Like this outfit", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // Voting the other way flips rather than stacking.
    await cardAfter.getByRole("button", { name: "Dislike this outfit" }).click();
    await expect(cardAfter.getByRole("button", { name: "Dislike this outfit" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      cardAfter.getByRole("button", { name: "Like this outfit", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");

    // Re-voting the same way clears (leaves the table clean for later specs).
    await cardAfter.getByRole("button", { name: "Dislike this outfit" }).click();
    await expect(cardAfter.getByRole("button", { name: "Dislike this outfit" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("api tri-state toggle", async ({ page }) => {
    const u = "22222222-2222-2222-2222-222222222222";
    const post = (verdict: string) =>
      page.request.post("/api/preferences", { data: { itemIds: [u], verdict } });
    expect((await (await post("like")).json()).vote).toBe("like");
    expect((await (await post("dislike")).json()).vote).toBe("dislike");
    expect((await (await post("dislike")).json()).vote).toBe(null);
  });
});
