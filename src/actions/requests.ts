"use server";



import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";



import { db } from "@/db";
import {
  auditLogs,
  examRequests,
  user,
} from "@/db/schema";
import { ROLES, type AppRole, type RequestStatus } from "@/lib/constants";
import { ConflictError } from "@/lib/errors";
import { queueAndTrySendEmail, type NotificationType } from "@/lib/mail";
import { canCancelRequest } from "@/lib/permissions";

import { requireRole, requireSession } from "@/lib/session";
import { transitionSchema } from "@/lib/validation";
import { transitionRequest } from "@/lib/workflow";


async function notifyActiveRole(
  role: AppRole,
  input: {
    requestId: string;
    type: NotificationType;
    subject: string;
    message: (name: string) => string;
  },
) {
  const recipients = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(and(eq(user.role, role), eq(user.banned, false)));
  await Promise.allSettled(
    recipients.map((recipient) =>
      queueAndTrySendEmail({
        userId: recipient.id,
        requestId: input.requestId,
        type: input.type,
        emailTo: recipient.email,
        subject: input.subject,
        message: input.message(recipient.name),
      }),
    ),
  );
}

async function notifyRequestTransition(
  request: typeof examRequests.$inferSelect,
  toStatus: RequestStatus,
  reason?: string,
) {
  if (toStatus === "รอตรวจสอบ") {
    await notifyActiveRole(ROLES.AV_UNIT, {
      requestId: request.id,
      type: "คำขอใหม่",
      subject: `มีคำขอใหม่ ${request.requestNo}`,
      message: (name) =>
        `เรียน ${name}\n\nมีคำขอ ${request.requestNo} รอตรวจสอบในระบบ`,
    });
    return;
  }

  const [recipient] = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, request.instructorId))
    .limit(1);
  const typeByStatus: Partial<Record<RequestStatus, NotificationType>> = {
    "ปฏิเสธ/ส่งกลับแก้ไข": "ส่งกลับแก้ไข",
    "ตัดข้อสอบ": "รับคำขอ",
    "กำลังพิมพ์": "เริ่มพิมพ์",
    "พิมพ์เสร็จแล้ว": "พิมพ์เสร็จ",
  };
  const type = typeByStatus[toStatus];
  if (recipient && type) {
    await Promise.allSettled([
      queueAndTrySendEmail({
        userId: recipient.id,
        requestId: request.id,
        type,
        emailTo: recipient.email,
        subject: `คำขอ ${request.requestNo}: ${toStatus}`,
        message: `เรียน ${recipient.name}\n\nคำขอ ${request.requestNo} เปลี่ยนสถานะเป็น “${toStatus}”${reason ? `\nเหตุผล/หมายเหตุ: ${reason}` : ""}`,
      }),
    ]);
  }

  if (toStatus === "พิมพ์เสร็จแล้ว") {
    await notifyActiveRole(ROLES.OFFICER, {
      requestId: request.id,
      type: "พิมพ์เสร็จ",
      subject: `ข้อสอบ ${request.requestNo} พิมพ์เสร็จแล้ว`,
      message: (name) =>
        `เรียน ${name}\n\nข้อสอบของคำขอ ${request.requestNo} พิมพ์เสร็จแล้วและจบงานในระบบ สามารถประสานหน่วยโสตเพื่อนำซองข้อสอบไปใช้ตามตารางสอบ`,
    });
  }
}

export async function cancelRequestAction(formData: FormData) {
  const session = await requireRole([ROLES.INSTRUCTOR]);
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const now = new Date();
  const cancelled = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
    const [request] = await tx
      .select()
      .from(examRequests)
      .where(eq(examRequests.id, requestId))
      .for("update")
      .limit(1);
    if (
      !request ||
      !canCancelRequest({
        role: session.user.role,
        userId: session.user.id,
        instructorId: request.instructorId,
        status: request.status,
        cancelledAt: request.cancelledAt,
      })
    ) {
      throw new ConflictError("คำขอนี้ไม่สามารถยกเลิกได้");
    }
    const [updated] = await tx
      .update(examRequests)
      .set({
        cancelledAt: now,
        cancelledBy: session.user.id,
        cancellationReason: reason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(examRequests.id, request.id),
          eq(examRequests.status, request.status),
          isNull(examRequests.cancelledAt),
        ),
      )
      .returning();
    if (!updated) throw new ConflictError("สถานะคำขอเปลี่ยนแล้ว กรุณาลองใหม่");
    await tx.insert(auditLogs).values({
      actorId: session.user.id,
      actorUsernameSnapshot: session.user.username,
      actorRoleSnapshot: session.user.role,
      action: "REQUEST_CANCELLED",
      targetType: "exam_request",
      targetId: request.id,
      metadata: { reason: reason || null, statusAtCancellation: request.status },
    });
    return updated;
  });
  await notifyActiveRole(ROLES.AV_UNIT, {
    requestId: cancelled.id,
    type: "ยกเลิกคำขอ",
    subject: `ยกเลิกคำขอ ${cancelled.requestNo}`,
    message: (name) =>
      `เรียน ${name}\n\nอาจารย์ยกเลิกคำขอ ${cancelled.requestNo}${reason ? `\nเหตุผล: ${reason}` : ""}`,
  });
  redirect("/dashboard/requests");
}

export async function transitionRequestAction(formData: FormData) {
  const session = await requireSession();
  const parsed = transitionSchema.parse({
    requestId: formData.get("requestId"),
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason") ?? "",
  });
  const updated = await transitionRequest({
    requestId: parsed.requestId,
    toStatus: parsed.toStatus as RequestStatus,
    reason: parsed.reason,
    actor: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
    },
  });

  await notifyRequestTransition(updated, parsed.toStatus, parsed.reason);
  revalidatePath(`/dashboard/requests/${updated.id}`);
  revalidatePath("/dashboard/requests");
}
