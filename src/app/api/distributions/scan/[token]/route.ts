import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  deliveries,
  distributions,
  examRequests,
  requestRooms,
} from "@/db/schema";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { AppError, ConflictError, errorResponse } from "@/lib/errors";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    await requireRole([ROLES.OFFICER]);
    const { token } = await params;
    return Response.redirect(new URL(`/scan/${token}`, request.url), 302);
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) {
      const { token } = await params;
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `/scan/${token}`);
      return Response.redirect(login, 302);
    }
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const { token } = await params;
    const body = (await request.json().catch(() => ({}))) as { note?: unknown };
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : null;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`distribution:${token}`}))`,
      );
      const [record] = await tx
        .select({ room: requestRooms, request: examRequests, delivery: deliveries })
        .from(requestRooms)
        .innerJoin(examRequests, eq(requestRooms.requestId, examRequests.id))
        .innerJoin(deliveries, eq(deliveries.requestId, examRequests.id))
        .where(eq(requestRooms.qrToken, token))
        .limit(1);
      if (!record) throw new AppError("QR Code ไม่ถูกต้อง", 404, "NOT_FOUND");
      if (record.request.status !== REQUEST_STATUSES.DELIVERED) {
        throw new ConflictError("ข้อสอบยังไม่ได้รับมอบ จึงบันทึกการแจกจ่ายไม่ได้");
      }
      const existing = await tx
        .select({ id: distributions.id })
        .from(distributions)
        .where(eq(distributions.requestRoomId, record.room.id))
        .limit(1);
      if (existing.length) throw new ConflictError("ห้องสอบนี้ถูกบันทึกการแจกจ่ายแล้ว");

      const [distribution] = await tx
        .insert(distributions)
        .values({
          deliveryId: record.delivery.id,
          requestRoomId: record.room.id,
          distributedBy: session.user.id,
          note,
        })
        .returning();
      await tx.insert(auditLogs).values({
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
        action: "EXAM_DISTRIBUTED",
        targetType: "distribution",
        targetId: distribution?.id,
        metadata: {
          requestId: record.request.id,
          requestRoomId: record.room.id,
          roomCode: record.room.roomCode,
        },
      });
      return distribution;
    });
    return Response.json({ ok: true, distribution: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
