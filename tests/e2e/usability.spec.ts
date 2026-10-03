import { expect, test } from "@playwright/test";

// Opt-in local review accounts from scripts/seed-review.ts; never seed production.
test.skip(!process.env.REVIEW_PASSWORD, "Requires local review accounts and REVIEW_PASSWORD");

for (const [account, role, destination, heading] of [
  ["review.officer", "เจ้าหน้าที่", "subjects", "รายวิชาและตารางสอบ"],
  ["review.teacher", "อาจารย์", "requests/new", "ส่งข้อสอบ"],
  ["review.print", "หน่วยโสต", "printing", "งานพิมพ์"],
  ["review.admin", "ผู้ดูแลระบบ", "users", "จัดการผู้ใช้"],
]) {
  test(`${role}: navigation, layout and request filters`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/login");
    await page.getByLabel("Username", { exact: true }).fill(account);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(process.env.REVIEW_PASSWORD!);
    for (let attempt = 0; attempt < 3; attempt++) {
      const responsePromise = page.waitForResponse(response => response.url().includes("/sign-in/username"));
      await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
      if ((await responsePromise).status() !== 429) break;
      // Respect the authentication rate limit while exercising multiple roles on one IP.
      await page.waitForTimeout(11_000);
    }
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("region", { name: "งานของคุณ" })).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: "เปิดเมนู" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "คำขอข้อสอบ", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page.goto(`/dashboard/${destination}`);
    await expect(page.getByRole("heading", { name: heading, exact: false }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("role-page.png"), fullPage: true });
    await page.goto("/dashboard/requests");
    await page.getByLabel("ค้นหาคำขอ").fill("ไม่มีรายการทดสอบนี้");
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await expect(page.getByText("รายการคำขอ · 0 รายการ")).toBeVisible();
    await page.getByRole("link", { name: "ล้างตัวกรอง" }).click();
    await expect(page.getByLabel("ค้นหาคำขอ")).toHaveValue("");
    await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
  });
}
