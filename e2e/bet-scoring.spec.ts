import {expect,test} from "@playwright/test";
for(const width of [320,390]) test(`bet-first scoring at ${width}px keeps partner and ahead net in view`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.goto("/e2e/bet-scoring");
 await expect(page.getByRole("heading",{name:"First 6",exact:true})).toBeVisible();
 await expect(page.getByRole("region",{name:"Other group"})).toContainText("Latest saved: hole 2");
 const own=page.getByRole("region",{name:"Score for Alex"});
 await expect(own).toContainText("Partner: Eddie");
 await expect(own).toContainText("Partner net 3");
 const inputBox=await page.getByLabel("Strokes for Alex").boundingBox();
 expect(inputBox!.y).toBeLessThan(650);
 const firstCard=await own.boundingBox();
 const secondCard=await page.getByRole("region",{name:"Score for Bill"}).boundingBox();
 expect(secondCard!.y-(firstCard!.y+firstCard!.height)).toBeGreaterThanOrEqual(16);
 const standings=page.getByRole("group",{name:"Pair standings"});
 await expect(standings).not.toHaveAttribute("open","");
 await page.getByText("Pair standings",{exact:true}).click();
 await expect(standings).toContainText("Eddie / Alex");
 await page.getByText("Pair standings",{exact:true}).click();
 await page.getByLabel("Strokes for Alex").fill("5");
 await expect(own).toContainText("Your net 4");
 await expect(own).toContainText("Pair best net 3");
 await page.getByRole("button",{name:"Refresh saved scores"}).click();
 await expect(page.getByLabel("Strokes for Alex")).toHaveValue("5");
 await page.getByRole("button",{name:"Discard unsaved changes"}).click();
 await expect(page.getByLabel("Strokes for Alex")).toHaveValue("5");
 await expect(page.getByRole("button",{name:"Next hole",exact:true})).toBeDisabled();
 await expect(page.getByRole("status").last()).toHaveText("Could not reload. Unsaved changes kept.");
 await expect(page.getByRole("heading",{name:"Second 6",exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.getByRole("button",{name:"Save this hole"}).click();
 await expect(page.getByRole("status").last()).toHaveText("Scores saved");
});
test("finishing cannot silently discard a displayed score edit",async({page})=>{
 await page.goto("/e2e/bet-scoring");
 await page.getByRole("button",{name:"Simulate completed groups"}).click();
 await page.getByRole("button",{name:"Finish round & show winnings",exact:true}).click();
 await page.getByLabel("Strokes for Alex").fill("6");
 await expect(page.getByRole("button",{name:"Confirm finish & show winnings",exact:true})).toBeDisabled();
});
test("score entry fits a narrow phone with larger text",async({page})=>{
 await page.setViewportSize({width:280,height:844});await page.goto("/e2e/bet-scoring");
 await page.addStyleTag({content:"html { font-size: 20px; }"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
 for(const field of await page.getByRole("textbox").all()) {const box=await field.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(280);}
});
