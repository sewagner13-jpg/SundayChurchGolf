import { expect, test } from "@playwright/test";

test("handicap scoring shows every group player and requires gross scores", async ({ page }) => {
  await page.goto("/e2e/handicap-strokes");

  await expect(page.getByRole("heading", { name: "Handicap Shots" })).toBeVisible();
  await expect(page.getByText("Albert", { exact: true })).toBeVisible();
  await expect(page.getByText("Eddie", { exact: true })).toBeVisible();
  await expect(page.getByText("Griff", { exact: true })).toBeVisible();
  await expect(page.getByText("Mike", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter gross score", { exact: true })).toBeVisible();
  await expect(page.getByText("Gets 1 shot", { exact: true })).toBeVisible();
  await expect(page.getByText("Gross 5 · Net 4", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Hole 3, current hole" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Hole 18" })).toBeVisible();
});
