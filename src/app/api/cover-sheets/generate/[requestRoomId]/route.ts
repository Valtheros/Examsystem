import { randomUUID } from "node:crypto";

import { eq, max, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  coverSheets,
  examRequests,
  requestRooms,
  subjects,
} from "@/db/schema";
import { createCoverPdf } from "@/lib/cover-pdf";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { AppError, ConflictError, errorResponse } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import { deletePrivateObject, putPrivateObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestRoomId: string }> },
) {
  try {
    const session = await requireRole([ROLES.AV_UNIT]);
    const { requestRoomId } = await params;
    const [data] = await db
      .select({
        room: requestRooms,
        request: examRequests,
        subject: subjects,
      })
      .from(requestRooms)
      .innerJoin(examRequests, eq(requestRooms.requestId, examRequests.id))
      .innerJoin(subjects, eq(examRequests.subjectId, subjects.id))
      .where(eq(requestRooms.id, requestRoomId))
      .limit(1);
    if (!data) throw new AppError("ไม่พบข้อมูลห้องของคำขอ", 404, "NOT_FOUND");
    if (
      ![
        REQUEST_STATUSES.CUTTING,
        REQUEST_STATUSES.PRINTING,
        REQUEST_STATUSES.PRINTED,
      ].includes(data.request.status as typeof REQUEST_STATUSES.CUTTING)
    ) {
      throw new ConflictError("สร้างใบปะหน้าได้ตั้งแต่สถานะตัดข้อสอบจนถึงพิมพ์เสร็จ");
    }

    const origin = new URL(request.url).origin;
    const pdf = await createCoverPdf({
      requestNo: data.request.requestNo,
      courseCode: data.subject.courseCode,
      courseName: data.subject.courseName,
      groupNo: data.subject.groupNo,
      examDate: data.room.examDate,
      startsAt: data.room.startsAt,
      endsAt: data.room.endsAt,
      roomCode: data.room.roomCode,
      roomName: data.room.roomName,
      building: data.room.building,
      studentCount: data.room.studentCount,
      printCount: data.room.printCount,
      senderName: data.room.senderName,
      note: data.room.note,
      scanUrl: `${origin}/api/distributions/scan/${data.room.qrToken}`,
    });
    const storageKey = `cover-sheets/${data.request.id}/${randomUUID()}.pdf`;
    await putPrivateObject({
      storageKey,
      body: pdf.bytes,
      contentType: "application/pdf",
      sha256: pdf.sha256,
    });
    let cover;
    try {
      [cover] = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`cover:${data.room.id}`}))`,
        );
        const [lockedRequest] = await tx
          .select({ status: examRequests.status })
          .from(examRequests)
          .where(eq(examRequests.id, data.request.id))
          .for("update")
          .limit(1);
        if (
          !lockedRequest ||
          ![
            REQUEST_STATUSES.CUTTING,
            REQUEST_STATUSES.PRINTING,
            REQUEST_STATUSES.PRINTED,
          ].includes(lockedRequest.status as typeof REQUEST_STATUSES.CUTTING)
        ) {
          throw new ConflictError("สถานะคำขอเปลี่ยนแล้ว ไม่สามารถสร้างใบปะหน้าได้");
        }
        const [latest] = await tx
          .select({ version: max(coverSheets.version) })
          .from(coverSheets)
          .where(eq(coverSheets.requestRoomId, data.room.id));
        const version = (latest?.version ?? 0) + 1;
        const inserted = await tx
          .insert(coverSheets)
          .values({
            requestRoomId: data.room.id,
            storageKey,
            sha256: pdf.sha256,
            version,
            generatedBy: session.user.id,
          })
          .returning();
        await tx.insert(auditLogs).values({
          actorId: session.user.id,
          actorUsernameSnapshot: session.user.username,
          actorRoleSnapshot: session.user.role,
          action: "COVER_SHEET_GENERATED",
          targetType: "cover_sheet",
          targetId: inserted[0]?.id,
          metadata: { requestRoomId: data.room.id, version },
        });
        return inserted;
      });
    } catch (error) {
      await deletePrivateObject(storageKey).catch(() => undefined);
      throw error;
    }
    return Response.json({ ok: true, cover }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
