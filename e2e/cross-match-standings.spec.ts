import {expect,test} from "@playwright/test";

for (const width of [320,390]) {
  test(`individual live matches fit ${width}px and update saved holes`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto("/e2e/cross-foursome-phone");
    const matches=page.getByRole("region",{name:"Individual matches"});
    await expect(matches.getByRole("article")).toHaveCount(4);
    const first=matches.getByRole("article").first();
    await expect(first.getByText("0/6 holes complete",{exact:true})).toBeVisible();
    await first.getByText("Hole-by-hole scores",{exact:true}).click();
    await expect(first.getByText("Waiting for all players",{exact:true}).first()).toBeVisible();
    await page.getByLabel("Your unsaved gross").fill("7");
    await page.getByRole("button",{name:"Refresh scores",exact:true}).click();
    await expect(first.getByText("1/6 holes complete",{exact:true})).toBeVisible();
    await expect(first.getByText("Eddie / Alex Long-Name Wagner leads by 1 hole",{exact:true})).toBeVisible();
    await expect(first.getByText("Best ball 3",{exact:true})).toBeVisible();
    await expect(page.getByLabel("Your unsaved gross")).toHaveValue("7");
    await expect(first.locator("details")).toHaveAttribute("open","");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button",{name:"Toggle blind visibility"}).click();
    await expect(matches.getByText("Match scores are hidden by this round’s visibility settings.")).toBeVisible();
    await expect(matches.getByRole("article")).toHaveCount(0);
  });
}
