import { expect, test } from "@playwright/test";

test("phone winnings lists bet amounts that add to the player's total", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e/player-winnings");
  const receipt = page.getByRole("article", { name: "Albert winnings" });
  await expect(receipt.getByRole("heading", { name: "Albert", exact: true })).toBeVisible();
  for (const bet of ["First 6", "Second 6", "Third 6", "Overall 18", "Closest to the hole · Hole 3"]) {
    await expect(receipt.getByText(bet, { exact: true })).toBeVisible();
  }
  await expect(receipt.getByLabel("Total won $42.00")).toBeVisible();
  const cents = await receipt.locator("dd").allTextContents();
  expect(cents.reduce((sum, amount) => sum + Math.round(Number(amount.replace("$", "")) * 100), 0)).toBe(4200);
  await expect(page.getByRole("article", { name: "Eddie winnings" }).getByText("No bets won")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
