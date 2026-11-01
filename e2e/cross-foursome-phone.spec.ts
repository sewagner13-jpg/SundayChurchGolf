import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`phone partner scores fit ${width}px and wait for both carts`, async ({ page }) => {
    await page.setViewportSize({width, height: 844});
    await page.goto("/e2e/cross-foursome-phone");
    const panel = page.getByRole("region", {name: "Current hole partner scores"});
    await expect(panel.getByRole("heading", {name: "Shots & partners"})).toBeVisible();
    await expect(panel.getByText("Counts on this hole", {exact: true})).toHaveCount(2);
    await expect(panel.getByText("Waiting for both scores", {exact: true})).toHaveCount(2);
    await expect(page.getByRole("status").last()).toHaveText("Waiting for all pairs");
    await page.getByLabel("Your unsaved gross").fill("7");
    await panel.getByRole("button", {name: "Refresh scores"}).click();
    await expect(panel.getByText("Gross 4", {exact: true})).toBeVisible();
    await expect(panel.getByText("Net 3", {exact: true})).toBeVisible();
    await expect(page.getByRole("status").last()).toHaveText("All scores received");
    await expect(page.getByLabel("Your unsaved gross")).toHaveValue("7");
    const layout = await page.evaluate(() => ({width: window.innerWidth, scroll: document.documentElement.scrollWidth}));
    expect(layout.scroll).toBeLessThanOrEqual(layout.width);
    for (const control of await panel.locator("button, select, a").all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await panel.getByRole("link", {name: "Enter this hole’s scores ↓"}).click();
    await expect(page).toHaveURL(/#current-hole-score-entry$/);
    await page.getByRole("button", {name: "Toggle blind visibility"}).click();
    await expect(panel.getByText("Scores hidden", {exact: true})).toHaveCount(4);
    await expect(panel.getByText("Gross 4", {exact: true})).toHaveCount(0);
    await page.getByRole("button", {name: "Next segment"}).click();
    await expect(panel.getByText("Hole 7 · Par 4 · Stroke index 1")).toBeVisible();
    await expect(page.getByLabel("Your unsaved gross")).toHaveValue("7");
  });
}
