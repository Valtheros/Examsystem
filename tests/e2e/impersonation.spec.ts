import { expect, test } from "@playwright/test";

test("administrator impersonates an instructor and returns with audit history", async ({ page }, info) => {
  test.skip(!process.env.REVIEW_PASSWORD, "Requires local review accounts");
  test.setTimeout(90_000);
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
  const original = await (await page.request.get("/api/auth/get-session")).json();
  await page.goto("/dashboard/users?q=review.teacher");
  const row = page.getByRole("row").filter({ hasText: "review.teacher" });
  await row.getByText("จัดการบัญชี", { exact: true }).click();
  const nativeDialogs: string[] = [];
  page.on("dialog", async dialog => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
  await row.getByRole("button", { name: "เข้าใช้งานแทน", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ไม่ใช่โหมดดูตัวอย่าง", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await (await page.request.get("/api/auth/get-session")).json()).user.id).toBe(original.user.id);
  await row.getByRole("button", { name: "เข้าใช้งานแทน", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await row.getByRole("button", { name: "เข้าใช้งานแทน", exact: true }).click();
  await page.screenshot({ path: info.outputPath("impersonation-confirmation.png"), animations: "disabled", fullPage: true });
  const startedPromise = page.waitForResponse(r => r.url().includes("/admin/impersonate-user"));
  await dialog.getByRole("button", { name: "ยืนยันเข้าใช้งานแทน", exact: true }).click();
  expect((await startedPromise).ok()).toBe(true);
  await expect(page.getByRole("complementary", { name: "โหมดเข้าใช้งานแทน" })).toBeVisible();
  const effective = await (await page.request.get("/api/auth/get-session")).json();
  expect(effective.user.username).toBe("review.teacher");
  expect(effective.session.impersonatedBy).toBe(original.user.id);
  const forbidden = await page.request.post("/api/auth/admin/impersonate-user", { data: { userId: original.user.id }, headers: { origin: new URL(page.url()).origin } });
  expect(forbidden.ok()).toBe(false);
  await page.goto("/dashboard/users");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "กลับบัญชีผู้ดูแลระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/users$/);
  await expect(page.getByRole("complementary", { name: "โหมดเข้าใช้งานแทน" })).toHaveCount(0);
  const restored = await (await page.request.get("/api/auth/get-session")).json();
  expect(restored.user.id).toBe(original.user.id);
  await page.goto("/dashboard/audit?q=IMPERSONATION");
  await expect(page.getByText("IMPERSONATION_STARTED", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("IMPERSONATION_ENDED", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("impersonation-audit.png"), fullPage: true });
  expect(nativeDialogs).toEqual([]);
});
