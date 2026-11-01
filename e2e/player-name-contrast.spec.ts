import { expect, test, type Locator } from "@playwright/test";

async function expectBlackName(locator: Locator) {
  const style = await locator.evaluate(element => {
    const foreground = getComputedStyle(element);
    let parent: Element | null = element;
    let background = "";
    let opacity = 1;
    while (parent) {
      const css = getComputedStyle(parent);
      opacity *= Number(css.opacity);
      if (!background && css.backgroundColor !== "rgba(0, 0, 0, 0)") background = css.backgroundColor;
      parent = parent.parentElement;
    }
    const rgb = background.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const linear = rgb.map(value => {const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;});
    return {color: foreground.color, weight: Number(foreground.fontWeight), opacity,
      contrast: (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05) / 0.05};
  });
  expect(style.color).toBe("rgb(0, 0, 0)");
  expect(style.weight).toBeGreaterThanOrEqual(600);
  expect(style.opacity).toBe(1);
  expect(style.contrast).toBeGreaterThan(14);
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [320, 390]) {
    test(`${colorScheme} ${width}px player names stay black, including selected and disabled`, async ({page}) => {
      await page.setViewportSize({width, height: 844});
      await page.emulateMedia({colorScheme});
      await page.goto("/e2e/handicap-strokes");
      await expectBlackName(page.getByText("Albert", {exact: true}));
      await page.goto("/e2e/cross-foursome-phone");
      await expectBlackName(page.getByText("Alex Long-Name Wagner", {exact: true}).first());
      await expectBlackName(page.getByText("Eddie", {exact: true}));
      await page.goto("/e2e/player-name-contrast");
      const disabled = page.getByRole("button", {name: "Alex", exact: true});
      const selected = page.getByRole("button", {name: "Bill", exact: true});
      await expect(disabled).toBeDisabled();
      await selected.click();
      await expectBlackName(disabled);
      await expectBlackName(selected);
      expect(await selected.evaluate(element => getComputedStyle(element).backgroundColor))
        .not.toBe(await disabled.evaluate(element => getComputedStyle(element).backgroundColor));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}
