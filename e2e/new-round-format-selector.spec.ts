import { expect, test } from "@playwright/test";

const courseFixture = {
  id: "course-1",
  name: "Timberlake Country Club",
  holes: Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, par: 4 })),
};

const formatFixtures = [
  {
    id: "sunday-church",
    name: "Sunday Church Scramble Skins",
    definitionId: "default-sunday-church",
    gameDescription: "Every hole is a skin.",
    formatCategory: "skins",
    supportedTeamSizes: [4],
    configOptions: [],
    requiresIndividualScores: false,
    requiresDriveTracking: false,
  },
  {
    id: "cross-threesome",
    name: "Cross-Threesome 6-6-6",
    definitionId: "cross_threesome_6_6_6",
    gameDescription: "Cross-Threesome 6-6-6 uses net best ball.",
    formatCategory: "match",
    supportedTeamSizes: [3],
    configOptions: [],
    requiresIndividualScores: true,
    requiresDriveTracking: false,
  },
];

test("new-round setup selects a configured format from fixture data", async ({ page }) => {
  const expectedFormat = process.env.E2E_EXPECTED_FORMAT_NAME ?? "Cross-Threesome 6-6-6";

  await page.route("**/api/courses", (route) => route.fulfill({ json: [courseFixture] }));
  await page.route("**/api/formats", (route) => route.fulfill({ json: formatFixtures }));

  await page.goto("/rounds/new");

  const formatSelect = page.getByLabel("Format");
  await expect(formatSelect).toHaveValue("sunday-church");
  await formatSelect.selectOption("cross-threesome");
  await expect(formatSelect).toHaveValue("cross-threesome");
  await expect(page.getByText(`${expectedFormat} uses net best ball.`, { exact: true })).toBeVisible();
});
