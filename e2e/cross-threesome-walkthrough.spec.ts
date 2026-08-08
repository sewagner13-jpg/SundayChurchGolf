import { expect, test } from "@playwright/test";

test("cross-threesome sandbox recalculates relative-handicap match play from gross scores", async ({ page }) => {
  await page.goto("/e2e/cross-threesome-walkthrough");

  await expect(
    page.getByRole("heading", { name: "Cross-Threesome 6-6-6 Sandbox" })
  ).toBeVisible();
  await expect(page.getByText("Lowest handicap plays from zero", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter gross scores only", { exact: true })).toBeVisible();
  await expect(page.getByText("Jim / Albert wins hole 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payout Breakdown" })).toBeVisible();
  await expect(page.getByText("$30.00 buy-in × 6 players = $180.00 total pot", { exact: true })).toBeVisible();
  await expect(page.getByText("3 games at $60.00 each", { exact: true })).toBeVisible();
  await expect(
    page.getByText("David / Griff · 2 holes won · $30.00 pair · $15.00 each", {
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByRole("row", { name: "Griff $60.00" })).toBeVisible();

  await page.getByRole("button", { name: "Hole 4" }).click();
  await expect(
    page.getByText("Two tie, all tie. No team wins hole 4.", { exact: true })
  ).toBeVisible();

  await page.getByLabel("Gross score for Jim").fill("4");
  await expect(page.getByText("Gross 4 · 1 shot · Net 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Jim / Albert wins hole 4", { exact: true })).toBeVisible();
});
