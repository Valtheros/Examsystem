import "server-only";

import { eq, sql } from "drizzle-orm";
import nodemailer from "nodemailer";

import { db } from "@/db";
import { notifications } from "@/db/schema";

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

function getTransporter() {
  if ((process.env.MAIL_TRANSPORT ?? "smtp") === "gmail") {
    return nodemailer.createTransport({
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
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
  });
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
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  if (!notification) throw new Error("ไม่พบรายการแจ้งเตือน");

  await db
    .update(notifications)
    .set({ attempts: sql`${notifications.attempts} + 1` })
    .where(eq(notifications.id, notificationId));

  try {
    await getTransporter().sendMail({
      from:
        process.env.MAIL_FROM ??
        "ระบบจัดพิมพ์ข้อสอบ <no-reply@example.local>",
      to: notification.emailTo,
      subject: notification.subject,
      text: notification.message,
    });
    await db
      .update(notifications)
      .set({ deliveryStatus: "Sent", sentAt: new Date(), lastError: null })
      .where(eq(notifications.id, notificationId));
    return { status: "Sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown mail error";
    await db
      .update(notifications)
      .set({ deliveryStatus: "Failed", lastError: message.slice(0, 2000) })
      .where(eq(notifications.id, notificationId));
    return { status: "Failed" as const, error: message };
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
