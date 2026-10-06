import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  coverSheets,
  examFiles,
  examRequests,
  examRooms,
  rooms,
  printJobs,
  requestRooms,
  requestStatusHistory,
  notifications,
  subjects,
  user,
} from "@/db/schema";
import {
  REQUEST_STATUSES,
  BANGKOK_TIME_ZONE,
  ROLES,
  type AppRole,
  type RequestStatus,
} from "@/lib/constants";
import { ConflictError } from "@/lib/errors";
import { assertRequestTransition } from "@/lib/permissions";
import { submissionFormSchema, validateRequestedRooms } from "@/lib/submission-form";
import { INSTRUCTOR_STATUS_NOTIFICATIONS } from "@/lib/notification-types";
import type { NotificationType } from "@/lib/mail";

type TransitionActor = {
  id: string;
  username: string;
  role: AppRole;
};

export async function transitionRequest(input: {
  requestId: string;
  toStatus: RequestStatus;
  reason?: string;
  actor: TransitionActor;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
    const [request] = await tx
      .select()
      .from(examRequests)
      .where(
        and(eq(examRequests.id, input.requestId), isNull(examRequests.cancelledAt)),
      )
      .for("update")
      .limit(1);
    if (!request) throw new ConflictError("ไม่พบคำขอหรือคำขอถูกยกเลิกแล้ว");

    assertRequestTransition(
      request.status,
      input.toStatus,
      input.actor.role,
      request.instructorId === input.actor.id,
    );

    if (input.toStatus === REQUEST_STATUSES.PENDING_REVIEW) {
      const formResult = submissionFormSchema.safeParse(request.submissionForm);
      if (!formResult.success) throw new ConflictError("กรุณากรอกแบบฟอร์มส่งข้อสอบให้ครบก่อนส่งตรวจ");
      const allocations = await tx.select({ examRoomId: requestRooms.examRoomId, count: requestRooms.studentCount, capacity: rooms.capacity }).from(requestRooms)
        .innerJoin(examRooms, eq(requestRooms.examRoomId, examRooms.id)).innerJoin(rooms, eq(examRooms.roomId, rooms.id)).where(eq(requestRooms.requestId, request.id));
      validateRequestedRooms(allocations, allocations, true);
      const [file] = await tx
        .select({ id: examFiles.id })
        .from(examFiles)
        .where(
          and(
            eq(examFiles.requestId, request.id),
            eq(examFiles.kind, "ต้นฉบับ"),
          ),
        )
        .limit(1);
      if (!file) throw new ConflictError("ต้องอัปโหลดไฟล์ข้อสอบต้นฉบับก่อนส่งตรวจ");
    }

    if (input.toStatus === REQUEST_STATUSES.CUTTING) {
      const [original] = await tx.select({ id: examFiles.id }).from(examFiles)
        .where(and(eq(examFiles.requestId, request.id), eq(examFiles.kind, "ต้นฉบับ"))).orderBy(desc(examFiles.version)).limit(1);
      if (!original) throw new ConflictError("ไม่พบไฟล์ต้นฉบับที่ส่งตรวจ");
      const [total] = await tx.select({ value: sql<number>`coalesce(sum(${requestRooms.printCount}), 0)::int` }).from(requestRooms).where(eq(requestRooms.requestId, request.id));
      await tx.insert(printJobs).values({ requestId: request.id, operatorId: input.actor.id, status: "รอพิมพ์", totalCopies: total.value, selectedExamFileId: original.id });
    }

    if (input.toStatus === REQUEST_STATUSES.PRINTING) {
      const [job] = await tx.select().from(printJobs).where(eq(printJobs.requestId, request.id));
      if (!job?.confirmedAt || !job.selectedExamFileId) throw new ConflictError("กรุณายืนยันไฟล์และจำนวนในส่วนเตรียมพิมพ์ก่อน");
      const [readyFile] = await tx
        .select({ id: examFiles.id })
        .from(examFiles)
        .where(
          and(
            eq(examFiles.requestId, request.id),
            eq(examFiles.id, job.selectedExamFileId),
          ),
        )
        .limit(1);
      if (!readyFile) throw new ConflictError("ไม่พบไฟล์ที่เลือกสำหรับงานพิมพ์นี้");
      const [roomCount] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(requestRooms)
        .where(eq(requestRooms.requestId, request.id));
      const [coverCount] = await tx
        .select({ value: sql<number>`count(distinct ${coverSheets.requestRoomId})::int` })
        .from(coverSheets)
        .innerJoin(requestRooms, eq(coverSheets.requestRoomId, requestRooms.id))
        .where(and(eq(requestRooms.requestId, request.id), eq(coverSheets.printRevision, job.revision)));
      if ((roomCount?.value ?? 0) === 0 || coverCount?.value !== roomCount?.value) {
        throw new ConflictError("ต้องสร้างใบปะหน้ารุ่นปัจจุบันให้ครบทุกห้องก่อนเริ่มพิมพ์");
      }
    }

    if (
      input.toStatus === REQUEST_STATUSES.RETURNED &&
      !input.reason?.trim()
    ) {
      throw new ConflictError("กรุณาระบุเหตุผลที่ส่งกลับแก้ไข");
    }

    const now = new Date();
    const [updated] = await tx
      .update(examRequests)
      .set({
        status: input.toStatus,
        rejectReason:
          input.toStatus === REQUEST_STATUSES.RETURNED
            ? input.reason?.trim()
            : input.toStatus === REQUEST_STATUSES.PENDING_REVIEW
              ? null
              : request.rejectReason,
        submittedAt:
          input.toStatus === REQUEST_STATUSES.PENDING_REVIEW
            ? now
            : request.submittedAt,
        lockedAt:
          input.toStatus === REQUEST_STATUSES.CUTTING ? now : request.lockedAt,
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
    if (!updated) throw new ConflictError("สถานะถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาลองใหม่");

    if (input.toStatus === REQUEST_STATUSES.PRINTING) {
      const [copyTotal] = await tx
        .select({
          value: sql<number>`coalesce(sum(${requestRooms.printCount}), 0)::int`,
        })
        .from(requestRooms)
        .where(eq(requestRooms.requestId, request.id));
      await tx.update(printJobs).set({
          operatorId: input.actor.id,
          status: "กำลังพิมพ์",
          totalCopies: copyTotal?.value ?? 0,
          startedAt: now,
          updatedAt: now,
        }).where(eq(printJobs.requestId, request.id));
    }

    if (input.toStatus === REQUEST_STATUSES.PRINTED) {
      await tx
        .update(printJobs)
        .set({ status: "พิมพ์เสร็จแล้ว", completedAt: now, updatedAt: now })
        .where(eq(printJobs.requestId, request.id));
    }

    await tx.insert(requestStatusHistory).values({
      requestId: request.id,
      fromStatus: request.status,
      toStatus: input.toStatus,
      actorId: input.actor.id,
      actorUsernameSnapshot: input.actor.username,
      actorRoleSnapshot: input.actor.role,
      reason: input.reason?.trim() || null,
      createdAt: now,
    });

    await tx.insert(auditLogs).values({
      actorId: input.actor.id,
      actorUsernameSnapshot: input.actor.username,
      actorRoleSnapshot: input.actor.role,
      action: "REQUEST_STATUS_CHANGED",
      targetType: "exam_request",
      targetId: request.id,
      metadata: {
        requestNo: request.requestNo,
        from: request.status,
        to: input.toStatus,
        reason: input.reason?.trim() || null,
      },
    });

    const notificationIds: string[] = [];
    const type = (INSTRUCTOR_STATUS_NOTIFICATIONS as Partial<Record<RequestStatus, NotificationType>>)[input.toStatus];
    if (type) {
      const [recipient] = await tx.select({ id: user.id, name: user.name, email: user.email, courseCode: subjects.courseCode, courseName: subjects.courseName })
        .from(user).innerJoin(subjects, eq(subjects.id, request.subjectId)).where(eq(user.id, request.instructorId)).limit(1);
      if (!recipient) throw new ConflictError("ไม่พบอาจารย์เจ้าของคำขอ");
      const url = new URL(`/dashboard/requests/${request.id}`, process.env.BETTER_AUTH_URL || "http://localhost:3000").href;
      const time = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: BANGKOK_TIME_ZONE }).format(now);
      const [notification] = await tx.insert(notifications).values({
        userId: recipient.id, requestId: request.id, type, emailTo: recipient.email,
        subject: `${recipient.courseCode} ${recipient.courseName}: ${input.toStatus}`,
        message: `เรียน ${recipient.name}\n\nรายวิชา: ${recipient.courseCode} ${recipient.courseName}\nคำขอ: ${request.requestNo}\nสถานะใหม่: ${input.toStatus}${input.toStatus === REQUEST_STATUSES.CUTTING ? " (รับงานแล้วและกำลังเตรียมพิมพ์)" : ""}\nอัปเดตเมื่อ: ${time}${input.reason?.trim() ? `\nเหตุผล/หมายเหตุ: ${input.reason.trim()}` : ""}\n\nเปิดคำขอ:\n${url}`,
        createdAt: now,
      }).returning({ id: notifications.id });
      notificationIds.push(notification.id);
    }
    return { request: updated, notificationIds };
  });
}

export function statusActionLabel(status: RequestStatus, role: AppRole) {
  if (role === ROLES.INSTRUCTOR) {
    return status === REQUEST_STATUSES.DRAFT
      ? "ส่งคำขอตรวจสอบ"
      : "ส่งคำขออีกครั้ง";
  }
  const labels: Partial<Record<RequestStatus, string>> = {
    [REQUEST_STATUSES.CUTTING]: "รับตัดข้อสอบ",
    [REQUEST_STATUSES.PRINTING]: "เริ่มพิมพ์",
    [REQUEST_STATUSES.PRINTED]: "ยืนยันพิมพ์เสร็จ",
  };
  return labels[status] ?? status;
}
