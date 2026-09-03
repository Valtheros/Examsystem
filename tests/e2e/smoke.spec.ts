import { expect, test } from "@playwright/test";

test("public home and login explain controlled account access", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /ระบบจัดพิมพ์ข้อสอบ/ })).toBeVisible();
  await page.getByRole("link", { name: "เข้าสู่ระบบ" }).first().click();
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await expect(page.getByText(/ไม่มีการสมัครสมาชิกด้วยตนเอง/)).toBeVisible();
});

test("self-registration API is disabled", async ({ request }) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: {
      name: "unauthorized",
      email: "unauthorized@example.com",
      password: "StrongPassword123",
    },
  });
  expect(response.ok()).toBe(false);
});
