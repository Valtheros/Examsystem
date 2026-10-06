"use server";



import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";



import { db } from "@/db";
import {
  auditLogs,
  examRequests,
} from "@/db/schema";
import { ROLES, type RequestStatus } from "@/lib/constants";
import { ConflictError } from "@/lib/errors";
import { sendQueuedEmail } from "@/lib/mail";
import { canCancelRequest } from "@/lib/permissions";

import { requireRole, requireSession } from "@/lib/session";
import { transitionSchema } from "@/lib/validation";
import { transitionRequest } from "@/lib/workflow";


export async function cancelRequestAction(formData: FormData) {
  const session = await requireRole([ROLES.INSTRUCTOR]);
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const now = new Date();
  await db.transaction(async (tx) => {
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
  redirect("/dashboard/requests");
}

export async function transitionRequestAction(formData: FormData) {
  const session = await requireSession();
  const parsed = transitionSchema.parse({
    requestId: formData.get("requestId"),
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason") ?? "",
  });
  const { request: updated, notificationIds } = await transitionRequest({
    requestId: parsed.requestId,
    toStatus: parsed.toStatus as RequestStatus,
    reason: parsed.reason,
    actor: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
    },
  });

  if (parsed.toStatus === "พิมพ์เสร็จแล้ว") {
    after(async () => { await Promise.allSettled(notificationIds.map(id => sendQueuedEmail(id))); });
  }
  revalidatePath(`/dashboard/requests/${updated.id}`);
  revalidatePath("/dashboard/requests");
}
