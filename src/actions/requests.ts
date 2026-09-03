"use server";

import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/actions/types";
import { actionError } from "@/actions/types";
import { db } from "@/db";
import {
  auditLogs,
  examRequests,
  examRooms,
  requestRooms,
  requestStatusHistory,
  rooms,
  subjects,
  user,
} from "@/db/schema";
import { ROLES, type AppRole, type RequestStatus } from "@/lib/constants";
import { ConflictError } from "@/lib/errors";
import { queueAndTrySendEmail, type NotificationType } from "@/lib/mail";
import { canCancelRequest, canEditRequest } from "@/lib/permissions";
import { calculatePrintCount } from "@/lib/printing";
import { requireRole, requireSession } from "@/lib/session";
import { examRequestSchema, transitionSchema } from "@/lib/validation";
import { transitionRequest } from "@/lib/workflow";

function requestNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `REQ-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

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
    "ส่งมอบแล้ว": "ส่งมอบ",
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
      type: "พร้อมส่งมอบ",
      subject: `ข้อสอบ ${request.requestNo} พร้อมส่งมอบ`,
      message: (name) =>
        `เรียน ${name}\n\nข้อสอบของคำขอ ${request.requestNo} พิมพ์เสร็จแล้วและพร้อมดำเนินการส่งมอบ`,
    });
  }
}

export async function createRequestAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdId: string | undefined;
  try {
    const session = await requireRole([ROLES.INSTRUCTOR]);
    const parsed = examRequestSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const [subject] = await db
      .select()
      .from(subjects)
      .where(
        and(
          eq(subjects.id, parsed.data.subjectId),
          eq(subjects.instructorId, session.user.id),
        ),
      )
      .limit(1);
    if (!subject) throw new ConflictError("ไม่พบรายวิชาที่คุณรับผิดชอบ");

    const schedules = await db
      .select({
        examRoomId: examRooms.id,
        examDate: examRooms.examDate,
        startsAt: examRooms.startsAt,
        endsAt: examRooms.endsAt,
        studentCount: examRooms.studentCount,
        note: examRooms.note,
        roomCode: rooms.code,
        roomName: rooms.name,
        building: rooms.building,
      })
      .from(examRooms)
      .innerJoin(rooms, eq(examRooms.roomId, rooms.id))
      .where(eq(examRooms.subjectId, subject.id));
    if (!schedules.length) {
      throw new ConflictError("รายวิชายังไม่มีห้องและตารางสอบ กรุณาติดต่อเจ้าหน้าที่");
    }

    const no = requestNumber();
    createdId = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      const [request] = await tx
        .insert(examRequests)
        .values({
          requestNo: no,
          subjectId: subject.id,
          instructorId: session.user.id,
          pageCount: parsed.data.pageCount,
          originalCopyCount: parsed.data.originalCopyCount,
          printDetail: parsed.data.printDetail || null,
        })
        .returning({ id: examRequests.id });
      if (!request) throw new Error("สร้างคำขอไม่สำเร็จ");

      await tx.insert(requestRooms).values(
        schedules.map((schedule) => ({
          requestId: request.id,
          examRoomId: schedule.examRoomId,
          roomCode: schedule.roomCode,
          roomName: schedule.roomName,
          building: schedule.building,
          examDate: schedule.examDate,
          startsAt: schedule.startsAt,
          endsAt: schedule.endsAt,
          studentCount: schedule.studentCount,
          reserveCount: 1,
          printCount: calculatePrintCount(schedule.studentCount),
          senderName: session.user.name,
          note: schedule.note,
        })),
      );
      await tx.insert(requestStatusHistory).values({
        requestId: request.id,
        fromStatus: null,
        toStatus: "ฉบับร่าง",
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
      });
      await tx.insert(auditLogs).values({
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
        action: "REQUEST_CREATED",
        targetType: "exam_request",
        targetId: request.id,
        metadata: { requestNo: no, subjectId: subject.id },
      });
      return request.id;
    });
  } catch (error) {
    return actionError(error);
  }
  redirect(`/dashboard/requests/${createdId}`);
}

export async function updateRequestAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.INSTRUCTOR]);
    const requestId = String(formData.get("requestId") ?? "");
    const parsed = examRequestSchema.omit({ subjectId: true }).safeParse({
      pageCount: formData.get("pageCount"),
      originalCopyCount: formData.get("originalCopyCount"),
      printDetail: formData.get("printDetail"),
    });
    if (!requestId || !parsed.success) {
      return { ok: false, message: parsed.success ? "ไม่พบคำขอ" : parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      const [request] = await tx
        .select()
        .from(examRequests)
        .where(eq(examRequests.id, requestId))
        .for("update")
        .limit(1);
      if (
        !request ||
        !canEditRequest({
          role: session.user.role,
          userId: session.user.id,
          instructorId: request.instructorId,
          status: request.status,
          cancelledAt: request.cancelledAt,
        })
      ) {
        throw new ConflictError("คำขอนี้แก้ไขไม่ได้แล้ว");
      }
      const [record] = await tx
        .update(examRequests)
        .set({
          ...parsed.data,
          printDetail: parsed.data.printDetail || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(examRequests.id, request.id),
            eq(examRequests.status, request.status),
            isNull(examRequests.cancelledAt),
          ),
        )
        .returning({ id: examRequests.id });
      if (!record) throw new ConflictError("สถานะคำขอเปลี่ยนแล้ว กรุณาลองใหม่");
      await tx.insert(auditLogs).values({
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
        action: "REQUEST_UPDATED",
        targetType: "exam_request",
        targetId: request.id,
        metadata: { pageCount: parsed.data.pageCount },
      });
      return record;
    });
    revalidatePath(`/dashboard/requests/${updated.id}`);
    return { ok: true, message: "บันทึกข้อมูลแล้ว" };
  } catch (error) {
    return actionError(error);
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
    reason: formData.get("reason"),
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

export async function deliverRequestAction(formData: FormData) {
  const session = await requireRole([ROLES.AV_UNIT]);
  const requestId = String(formData.get("requestId") ?? "");
  const receiverId = String(formData.get("receiverId") ?? "");
  const note = String(formData.get("note") ?? "");
  const [receiver] = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(and(eq(user.id, receiverId), eq(user.banned, false)))
    .limit(1);
  if (!receiver || receiver.role !== ROLES.OFFICER) {
    throw new ConflictError("ผู้รับมอบต้องเป็นเจ้าหน้าที่ที่เปิดใช้งานอยู่");
  }
  const updated = await transitionRequest({
    requestId,
    toStatus: "ส่งมอบแล้ว",
    reason: note,
    receiverId: receiver.id,
    receiverName: receiver.name,
    actor: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
    },
  });
  await notifyRequestTransition(updated, "ส่งมอบแล้ว", note);
  revalidatePath(`/dashboard/requests/${updated.id}`);
}
