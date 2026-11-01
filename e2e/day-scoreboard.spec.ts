import {expect,test} from "@playwright/test";
for(const width of [320,390]) test(`full-day scoreboard at ${width}px shows all bets without losing a draft`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto("/e2e/bet-scoring");
 await page.getByLabel("Strokes for Alex").fill("5");
 await page.getByRole("button",{name:"Full-day scoreboard",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Full-day scoreboard"});await expect(dialog).toBeVisible();
 for(const name of ["First 6","Second 6","Third 6","Overall 18"]) await expect(dialog.getByRole("heading",{name,exact:true})).toBeVisible();
 await expect(dialog.getByRole("table",{name:"Player net scorecard"})).toBeVisible();
 await expect(dialog.getByRole("table",{name:"Overall 18 best-ball scorecard"}).getByRole("columnheader",{name:"18",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await dialog.getByRole("button",{name:"Close scoreboard",exact:true}).click();
 await expect(page.getByLabel("Strokes for Alex")).toHaveValue("5");
 await expect(page.getByRole("status").last()).toHaveText("Unsaved changes");
 await expect(page.getByRole("button",{name:"Next hole",exact:true})).toBeDisabled();
});
