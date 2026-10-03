import { expect, test } from "@playwright/test";

test("request rows support keyboard and printed work ends above history", async ({ page }, info) => {
  test.skip(!process.env.REVIEW_PASSWORD, "Requires isolated test database with migration fixture");
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByLabel("Username", {exact:true}).fill("review.print");
  await page.getByLabel("รหัสผ่าน", {exact:true}).fill(process.env.REVIEW_PASSWORD!);
  for(let i=0;i<3;i++) {
    const response=page.waitForResponse(r=>r.url().includes("/sign-in/username"));
    await page.getByRole("button",{name:"เข้าสู่ระบบ",exact:true}).click();
    if((await response).status()!==429) break;
    await page.waitForTimeout(11_000);
  }
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/printing");
  const row=page.getByRole("list",{name:"รายการคำขอ",exact:true}).getByRole("link").filter({hasText:"MIGRATION-FIXTURE"});
  const href=await row.getAttribute("href");
  await expect(page.getByRole("button",{name:"เปิด",exact:true})).toHaveCount(0);
  await row.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(href!+"$"));
  const current=page.getByTestId("current-task");
  await expect(current.getByRole("heading",{name:"พิมพ์เสร็จแล้ว · จบงานในระบบ"})).toBeVisible();
  await expect(current.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"ยืนยันส่งมอบ"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/พิมพ์|ใบปะหน้า/})).toHaveCount(0);
  for(const width of [360,768,1024,1440]) {
    await page.setViewportSize({width,height:1000}); await page.evaluate(()=>scrollTo(0,0));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const task=await current.boundingBox();
    const history=await page.getByRole("region",{name:"ข้อมูลประกอบและประวัติ"}).boundingBox();
    expect(history!.y).toBeGreaterThanOrEqual(task!.y+task!.height);
    await page.screenshot({path:info.outputPath(`completed-${width}.png`),fullPage:true});
  }
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page.getByText("แบบฟอร์มที่อาจารย์ส่ง · 1 หน้า",{exact:true}).click();
  await expect(page.getByText("ไม่ได้ระบุในระบบเดิม",{exact:true})).toBeVisible();
});
