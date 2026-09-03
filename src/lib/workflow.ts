import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  coverSheets,
  deliveries,
  examFiles,
  examRequests,
  printJobs,
  requestRooms,
  requestStatusHistory,
} from "@/db/schema";
import {
  REQUEST_STATUSES,
  ROLES,
  type AppRole,
  type RequestStatus,
} from "@/lib/constants";
import { ConflictError } from "@/lib/errors";
import { assertRequestTransition } from "@/lib/permissions";

type TransitionActor = {
  id: string;
  username: string;
  role: AppRole;
};

export async function transitionRequest(input: {
  requestId: string;
  toStatus: RequestStatus;
  reason?: string;
  receiverId?: string;
  receiverName?: string;
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

    if (input.toStatus === REQUEST_STATUSES.PRINTING) {
      const [readyFile] = await tx
        .select({ id: examFiles.id })
        .from(examFiles)
        .where(
          and(
            eq(examFiles.requestId, request.id),
            eq(examFiles.kind, "พร้อมพิมพ์"),
          ),
        )
        .limit(1);
      if (!readyFile) throw new ConflictError("ต้องมีไฟล์พร้อมพิมพ์ก่อนเริ่มพิมพ์");
      const [roomCount] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(requestRooms)
        .where(eq(requestRooms.requestId, request.id));
      const [coverCount] = await tx
        .select({ value: sql<number>`count(distinct ${coverSheets.requestRoomId})::int` })
        .from(coverSheets)
        .innerJoin(requestRooms, eq(coverSheets.requestRoomId, requestRooms.id))
        .where(eq(requestRooms.requestId, request.id));
      if ((roomCount?.value ?? 0) === 0 || coverCount?.value !== roomCount?.value) {
        throw new ConflictError("ต้องสร้างใบปะหน้าให้ครบทุกห้องก่อนเริ่มพิมพ์");
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
      const existing = await tx
        .select({ id: printJobs.id })
        .from(printJobs)
        .where(eq(printJobs.requestId, request.id))
        .limit(1);
      if (!existing.length) {
        await tx.insert(printJobs).values({
          requestId: request.id,
          operatorId: input.actor.id,
          status: "กำลังพิมพ์",
          totalCopies: copyTotal?.value ?? 0,
          startedAt: now,
        });
      }
    }

    if (input.toStatus === REQUEST_STATUSES.PRINTED) {
      await tx
        .update(printJobs)
        .set({ status: "พิมพ์เสร็จแล้ว", completedAt: now, updatedAt: now })
        .where(eq(printJobs.requestId, request.id));
    }

    if (input.toStatus === REQUEST_STATUSES.DELIVERED) {
      if (!input.receiverId || !input.receiverName?.trim()) {
        throw new ConflictError("กรุณาระบุเจ้าหน้าที่ผู้รับมอบ");
      }
      await tx.insert(deliveries).values({
        requestId: request.id,
        senderId: input.actor.id,
        receiverId: input.receiverId,
        receiverNameSnapshot: input.receiverName.trim(),
        deliveredAt: now,
        note: input.reason?.trim() || null,
      });
    }

    await tx.insert(requestStatusHistory).values({
      requestId: request.id,
      fromStatus: request.status,
      toStatus: input.toStatus,
      actorId: input.actor.id,
      actorUsernameSnapshot: input.actor.username,
      actorRoleSnapshot: input.actor.role,
      reason: input.reason?.trim() || null,
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

    return updated;
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
    [REQUEST_STATUSES.DELIVERED]: "ยืนยันส่งมอบ",
  };
  return labels[status] ?? status;
}
