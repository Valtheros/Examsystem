import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));
import { emailHtml, getMailConfiguration, mailErrorMessage, sendMailMessage } from "./mail";

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ["MAIL_TRANSPORT", "MAIL_FROM", "GMAIL_USER", "GMAIL_APP_PASSWORD", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "SMTP_PORT", "SMTP_SECURE"]) vi.stubEnv(key, "");
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ accepted: ["teacher@example.local"] });
});
afterEach(() => vi.unstubAllEnvs());

describe("mail transport and safe messages", () => {
  const message = { emailTo: "teacher@example.local", subject: "ข้อสอบ <ทดสอบ>", message: "สถานะใหม่\nhttps://exam.example/dashboard/requests/123\n<script>bad</script>" };
  it("defaults to SMTP, bounds network time, sends text and escaped HTML without attachments", async () => {
    expect(getMailConfiguration()).toMatchObject({ transport: "smtp", configured: true });
    await sendMailMessage(message);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 1025, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000 }));
    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.text).toBe(message.message);
    expect(mail.html).toContain('<a href="https://exam.example/dashboard/requests/123"');
    expect(mail.html).not.toContain("<script>");
    expect(mail).not.toHaveProperty("attachments");
  });
  it("uses a whitespace-normalized App Password, does not expose it and never falls back when missing", async () => {
    vi.stubEnv("MAIL_TRANSPORT", "gmail-app-password"); vi.stubEnv("GMAIL_USER", "max.64466@gmail.com");
    expect(getMailConfiguration().configured).toBe(false);
    await expect(sendMailMessage(message)).rejects.toThrow("App Password");
    expect(mocks.createTransport).not.toHaveBeenCalled();
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    await sendMailMessage(message);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ service: "gmail", auth: { user: "max.64466@gmail.com", pass: "abcdefghijklmnop" } }));
    expect(JSON.stringify(getMailConfiguration())).not.toContain("abcdefghijklmnop");
    vi.stubEnv("MAIL_FROM", "Someone <other@gmail.com>");
    expect(getMailConfiguration().configured).toBe(false);
  });
  it("preserves OAuth2 compatibility", async () => {
    vi.stubEnv("MAIL_TRANSPORT", "gmail"); vi.stubEnv("GMAIL_USER", "sender@gmail.com");
    for (const key of ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"]) vi.stubEnv(key, "test-only");
    await sendMailMessage(message);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.objectContaining({ type: "OAuth2", refreshToken: "test-only" }) }));
  });
  it("rejects invalid or unaccepted recipients and sanitizes SMTP secrets", async () => {
    await expect(sendMailMessage({ ...message, emailTo: "invalid" })).rejects.toThrow("ปลายทาง");
    mocks.sendMail.mockResolvedValue({ accepted: ["someone-else@example.local"], rejected: [message.emailTo] });
    await expect(sendMailMessage(message)).rejects.toThrow("ไม่ยอมรับผู้รับ");
    expect(mailErrorMessage({ code: "EAUTH", message: "secret-password" })).not.toContain("secret-password");
    expect(mailErrorMessage({ code: "ETIMEDOUT" })).toContain("เชื่อมต่อ");
    expect(emailHtml('"quoted"', "<img src=x onerror=bad>")).not.toContain("<img");
  });
});
