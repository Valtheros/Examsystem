import { expect, test } from "@playwright/test";

test("reset confirmation, cancellation and error toast without deleting data", async ({ page }, info) => {
  test.skip(!process.env.REVIEW_PASSWORD, "Requires local review accounts");
  test.setTimeout(90_000);
  const nativeDialogs: string[] = [];
  const errors: string[] = [];
  page.on("dialog", async dialog => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
  page.on("pageerror", error => errors.push(error.message));
  let resetCalls = 0;
  // Intercept before navigation: this test must NEVER hit the real destructive endpoint.
  await page.route("**/api/admin/system-reset", async route => {
    resetCalls++;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ ok: false, message: "ทดสอบ: รหัสผ่านไม่ถูกต้อง" }) });
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("review.admin");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(process.env.REVIEW_PASSWORD!);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = page.waitForResponse(r => r.url().includes("/sign-in/username"));
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    if ((await response).status() !== 429) break;
    // Multiple review sessions share one IP; preserve the real rate limit.
    await page.waitForTimeout(11_000);
  }
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/reset");
  await page.getByLabel("รหัสผ่านปัจจุบัน").fill("only-a-mocked-password");
  await page.getByLabel("พิมพ์ RESET EXAM SYSTEM").fill("RESET EXAM SYSTEM");
  await page.getByRole("button", { name: "Factory Reset", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "ยกเลิก" })).toBeFocused();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  expect(resetCalls).toBe(0);
  await page.getByRole("button", { name: "Factory Reset", exact: true }).click();
  await expect(dialog).toBeInViewport();
  await page.screenshot({ path: info.outputPath("reset-confirmation.png"), animations: "disabled", fullPage: true });
  await dialog.getByRole("button", { name: "ยืนยันลบถาวร" }).click();
  const toast = page.locator('[data-sonner-toast][data-type="error"]');
  await expect(toast).toContainText("ทดสอบ: รหัสผ่านไม่ถูกต้อง");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "ทดสอบ: รหัสผ่านไม่ถูกต้อง" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("error-toast.png"), animations: "disabled", fullPage: true });
  await toast.getByRole("button", { name: "Close toast" }).click();
  await expect(toast).toHaveCount(0);
  expect(resetCalls).toBe(1);
  expect(nativeDialogs).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
