import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { AppError, ConflictError } from "@/lib/errors";

export type NotificationType =
  | "สร้างบัญชี"
  | "คำขอใหม่"
  | "ยกเลิกคำขอ"
  | "รับคำขอ"
  | "ส่งกลับแก้ไข"
  | "เริ่มพิมพ์"
  | "พิมพ์เสร็จ"
  | "พร้อมส่งมอบ"
  | "ส่งมอบ"
  | "รีเซ็ตรหัสผ่าน";

export const ACCOUNT_EMAIL_TYPES = ["สร้างบัญชี", "รีเซ็ตรหัสผ่าน"] as const;

export function getMailConfiguration() {
  const transport = process.env.MAIL_TRANSPORT?.trim() || "smtp";
  const gmail = transport === "gmail" || transport === "gmail-app-password";
  const user = process.env.GMAIL_USER?.trim() || "";
  const from = process.env.MAIL_FROM?.trim() || `ระบบจัดพิมพ์ข้อสอบ <${gmail ? user : "no-reply@example.local"}>`;
  const address = from.match(/<([^>]+)>/)?.[1] || from;
  let error: string | null = null;
  if (!["smtp", "gmail", "gmail-app-password"].includes(transport)) error = "ค่า MAIL_TRANSPORT ไม่ถูกต้อง";
  else if (!z.email().safeParse(address).success) error = "กรุณาตั้งค่า MAIL_FROM เป็นอีเมลผู้ส่งที่ถูกต้อง";
  else if (gmail && !z.email().safeParse(user).success) error = "กรุณาตั้งค่า GMAIL_USER เป็นอีเมลผู้ส่ง";
  else if (gmail && address.toLowerCase() !== user.toLowerCase()) error = "MAIL_FROM ต้องใช้อีเมลเดียวกับ GMAIL_USER";
  else if (transport === "gmail-app-password" && !/^[a-zA-Z0-9]{16}$/.test((process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, ""))) error = "กรุณาตั้งค่า GMAIL_APP_PASSWORD เป็น App Password 16 ตัวจาก Google";
  else if (transport === "gmail" && ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"].some(key => !process.env[key]?.trim())) error = "กรุณาตั้งค่า Gmail OAuth2 ให้ครบ: Client ID, Client Secret และ Refresh Token";
  else if (transport === "smtp" && (!Number.isInteger(Number(process.env.SMTP_PORT || 1025)) || Number(process.env.SMTP_PORT || 1025) < 1 || Number(process.env.SMTP_PORT || 1025) > 65535)) error = "ค่า SMTP_PORT ไม่ถูกต้อง";
  return { transport, from, sender: gmail ? user : address, configured: !error, error };
}

function getTransporter() {
  const config = getMailConfiguration();
  if (config.error) throw new AppError(config.error, 422, "MAIL_CONFIGURATION");
  const timeouts = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000 };
  if (config.transport === "gmail-app-password") return nodemailer.createTransport({
    ...timeouts, service: "gmail",
    auth: { user: process.env.GMAIL_USER?.trim(), pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") },
  });
  if (config.transport === "gmail") {
    return nodemailer.createTransport({
      ...timeouts,
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }

  return nodemailer.createTransport({
    ...timeouts,
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === "true",
  });
}

export function mailErrorMessage(error: unknown) {
  if (error instanceof AppError) return error.message;
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "EAUTH") return "ยืนยันบัญชีผู้ส่งไม่สำเร็จ กรุณาตรวจ App Password หรือข้อมูล OAuth2";
  if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "EDNS"].includes(String(code))) return "เชื่อมต่อเซิร์ฟเวอร์อีเมลไม่สำเร็จ กรุณาตรวจเครือข่ายแล้วลองใหม่";
  return "ส่งอีเมลไม่สำเร็จ เซิร์ฟเวอร์อาจปฏิเสธผู้รับหรือจำกัดการส่ง กรุณาตรวจการตั้งค่าแล้วลองใหม่";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function emailHtml(subject: string, message: string) {
  const body = escapeHtml(message).replace(/https?:\/\/[^\s<]+/g, url => `<a href="${url}" style="color:#073b70">${url}</a>`).replace(/\n/g, "<br>");
  return `<!doctype html><html lang="th"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#132e45"><main style="max-width:600px;margin:24px auto;background:#fff;padding:28px;border-top:4px solid #073b70"><h1 style="font-size:22px;line-height:1.5">${escapeHtml(subject)}</h1><p style="font-size:16px;line-height:1.8;overflow-wrap:anywhere">${body}</p><hr style="border:0;border-top:1px solid #dbe3eb"><p style="font-size:13px;color:#52667b">ระบบจัดพิมพ์ข้อสอบ · กรุณาเข้าสู่ระบบก่อนดูรายละเอียด</p></main></body></html>`;
}

export async function sendMailMessage(input: { emailTo: string; subject: string; message: string }) {
  if (!z.email().safeParse(input.emailTo).success) throw new AppError("อีเมลปลายทางไม่ถูกต้อง", 422, "MAIL_RECIPIENT");
  const info = await getTransporter().sendMail({ from: getMailConfiguration().from, to: input.emailTo, subject: input.subject, text: input.message, html: emailHtml(input.subject, input.message) });
  const accepted = info.accepted as (string | { address: string })[] | undefined;
  if (!accepted?.some(value => (typeof value === "string" ? value : value.address).toLowerCase() === input.emailTo.toLowerCase())) throw new AppError("เซิร์ฟเวอร์อีเมลไม่ยอมรับผู้รับ กรุณาตรวจอีเมลปลายทาง", 502, "MAIL_REJECTED");
}

export async function queueEmail(input: {
  userId?: string | null;
  requestId?: string | null;
  type: NotificationType;
  emailTo: string;
  subject: string;
  message: string;
}) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      requestId: input.requestId,
      type: input.type,
      emailTo: input.emailTo,
      subject: input.subject,
      message: input.message,
    })
    .returning({ id: notifications.id });

  if (!notification) throw new Error("ไม่สามารถสร้างรายการแจ้งเตือนได้");
  return notification.id;
}

export async function sendQueuedEmail(notificationId: string) {
  const connection = await db.$client.reserve();
  let resetAcquired = false;
  let sendAcquired = false;
  try {
    const [resetLock] = await connection`select pg_try_advisory_lock_shared(921001) as acquired`;
    if (!resetLock.acquired) throw new ConflictError("กำลังล้างข้อมูลระบบ กรุณาส่งอีเมลใหม่ภายหลัง");
    resetAcquired = true;
    const [sendLock] = await connection`select pg_try_advisory_lock(hashtextextended(${'email:' + notificationId}, 0)) as acquired`;
    if (!sendLock.acquired) throw new ConflictError("รายการนี้กำลังส่งอีเมลอยู่ กรุณารอสักครู่");
    sendAcquired = true;
    const [notification] = await connection<(Pick<typeof notifications.$inferSelect, "emailTo" | "subject" | "message" | "deliveryStatus" | "type"> & { requestOwner: boolean })[]>`
      select email_to as "emailTo", subject, message, type, delivery_status as "deliveryStatus",
        exists(select 1 from app.exam_requests r where r.id=n.request_id and r.instructor_id=n.user_id) as "requestOwner"
      from app.notifications n where n.id=${notificationId}::uuid`;
    if (!notification) throw new AppError("ไม่พบรายการแจ้งเตือน", 404, "NOT_FOUND");
    if (!ACCOUNT_EMAIL_TYPES.some(type => type === notification.type) && !(notification.type === "พิมพ์เสร็จ" && notification.requestOwner)) throw new AppError("เมลงานข้อสอบส่งเฉพาะเมื่อพิมพ์เสร็จถึงอาจารย์เจ้าของคำขอ รายการนี้ไม่ส่งอีเมล", 409, "EMAIL_DISABLED");
    if (notification.deliveryStatus === "Sent") return { status: "Sent" as const, alreadySent: true };
    // ponytail: reserve one connection during bounded SMTP, but no open transaction; add a worker if mail volume grows.
    await connection`update app.notifications set attempts=attempts+1 where id=${notificationId}::uuid`;
    try {
      await sendMailMessage(notification);
      await connection`update app.notifications set delivery_status='Sent', sent_at=now(), last_error=null where id=${notificationId}::uuid`;
      return { status: "Sent" as const };
    } catch (error) {
      const message = mailErrorMessage(error);
      await connection`update app.notifications set delivery_status='Failed', last_error=${message}, sent_at=null where id=${notificationId}::uuid`;
      return { status: "Failed" as const, error: message };
    }
  } finally {
    try {
      if (sendAcquired) await connection`select pg_advisory_unlock(hashtextextended(${'email:' + notificationId}, 0))`;
    } finally {
      try { if (resetAcquired) await connection`select pg_advisory_unlock_shared(921001)`; }
      finally { connection.release(); }
    }
  }
}

export async function queueAndTrySendEmail(
  input: Parameters<typeof queueEmail>[0],
) {
  const notificationId = await queueEmail(input);
  const result = await sendQueuedEmail(notificationId);
  return { notificationId, ...result };
}

export async function sendPasswordResetEmail(input: {
  userId: string;
  email: string;
  name: string;
  resetUrl: string;
}) {
  await queueAndTrySendEmail({
    userId: input.userId,
    type: "รีเซ็ตรหัสผ่าน",
    emailTo: input.email,
    subject: "ตั้งรหัสผ่านใหม่สำหรับระบบจัดพิมพ์ข้อสอบ",
    message: `เรียน ${input.name}\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ลิงก์มีอายุจำกัด):\n${input.resetUrl}\n\nหากคุณไม่ได้ร้องขอ โปรดติดต่อผู้ดูแลระบบ`,
  });
}
