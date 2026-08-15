import { expect, test } from "@playwright/test";

test("yellow-ball sandbox applies handicap dots and skin carryovers", async ({ page }, testInfo) => {
  await page.goto("/e2e/yellow-ball-walkthrough");
  await expect(page.getByRole("heading", { name: "Sunday Church Yellow Ball Skins Sandbox" })).toBeVisible();
  await page.getByRole("button", { name: "Lock Both Orders" }).click();

  await expect(page.getByText("Enter gross scores. Handicap applies only to yellow ball.")).toBeVisible();
  await expect(page.getByLabel("Team Bravo yellow-ball gross")).toHaveValue("5");
  await expect(page.getByText("Yellow net").nth(1).locator("..")).toContainText("4");
  await page.getByRole("button", { name: "Save Gross Scores" }).click();
  await expect(page.getByRole("status")).toHaveText("Hole 1 tied. Two tie, all tie; the skin carries.");
  await expect(page.getByTestId("yellow-ball-cell-team-a-1")).toContainText("8");
  await expect(page.getByTestId("yellow-ball-cell-team-a-1")).toContainText("Albert");
  await expect(page.getByTestId("yellow-ball-cell-team-b-1")).toContainText("8•");
  await expect(page.getByText("• Handicap-adjusted team total.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Hole 2" }).click();
  await page.getByRole("button", { name: "Save Gross Scores" }).click();
  await expect(page.getByRole("status")).toHaveText("Team Alpha wins 2 skins on Hole 2.");
  await expect(page.getByTestId("yellow-ball-cell-team-a-2")).toContainText("7•");
  await expect(page.getByTestId("yellow-ball-cell-team-a-2")).toContainText("Eddie");

  await page.getByRole("button", { name: "Hole 17" }).click();
  await page.getByRole("button", { name: "Team Alpha carrier Albert" }).click();
  await page.getByRole("button", { name: "Team Bravo carrier Jim" }).click();
  await page.getByLabel("Team Alpha yellow-ball gross").fill("4");
  await page.getByLabel("Team Alpha scramble gross").fill("4");
  await page.getByLabel("Team Bravo yellow-ball gross").fill("5");
  await page.getByLabel("Team Bravo scramble gross").fill("4");
  await page.getByRole("button", { name: "Save Gross Scores" }).click();
  await page.getByRole("button", { name: "Hole 18" }).click();
  await expect(page.getByRole("button", { name: "Team Alpha carrier Albert" })).toBeDisabled();
  await expect(page.getByText("Hole 18 must use a different yellow-ball player than Hole 17.").first()).toBeVisible();
  const scoreGrid = page.getByTestId("yellow-ball-score-grid");
  const currentHeader = scoreGrid.getByRole("columnheader", { name: "18 Par 5" });
  await expect.poll(async () => {
    const [gridBox, headerBox] = await Promise.all([
      scoreGrid.boundingBox(),
      currentHeader.boundingBox(),
    ]);
    return Boolean(
      gridBox &&
        headerBox &&
        headerBox.x >= gridBox.x &&
        headerBox.x + headerBox.width <= gridBox.x + gridBox.width
    );
  }).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("yellow-ball-desktop.png"), fullPage: true });
});

test("yellow-ball grid stays readable at 390 by 844", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e/yellow-ball-walkthrough");
  await page.getByRole("button", { name: "Lock Both Orders" }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole("button", { name: "Save Gross Scores" }).click();

  const grid = page.getByTestId("yellow-ball-score-grid");
  await expect(grid).toBeVisible();
  const layout = await grid.evaluate((element) => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    gridClientWidth: element.clientWidth,
    gridScrollWidth: element.scrollWidth,
    right: element.getBoundingClientRect().right,
  }));
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.gridScrollWidth).toBeGreaterThan(layout.gridClientWidth);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);

  const stickyTeam = grid.getByRole("columnheader", { name: "Team" });
  const before = await stickyTeam.boundingBox();
  await grid.evaluate((element) => {
    element.scrollLeft = 600;
  });
  const after = await stickyTeam.boundingBox();
  expect(Math.abs((before?.x ?? 0) - (after?.x ?? 0))).toBeLessThan(2);
  await expect(page.getByText("• Handicap-adjusted team total.", { exact: false })).toBeVisible();
  await grid.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("yellow-ball-mobile.png"), fullPage: true });
});
