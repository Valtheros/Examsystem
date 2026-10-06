import { randomUUID } from "node:crypto";

import { asc, eq, max, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  coverSheets,
  examRequests,
  printJobs,
  requestRooms,
  subjects,
  user,
} from "@/db/schema";
import { createCoverPdf } from "@/lib/cover-pdf";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { AppError, ConflictError, errorResponse } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import { deletePrivateObject, putPrivateObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
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
        senderName: user.name,
      })
      .from(requestRooms)
      .innerJoin(examRequests, eq(requestRooms.requestId, examRequests.id))
      .innerJoin(subjects, eq(examRequests.subjectId, subjects.id))
      .innerJoin(user, eq(examRequests.instructorId, user.id))
      .where(eq(requestRooms.id, requestRoomId))
      .limit(1);
    if (!data) throw new AppError("ไม่พบข้อมูลห้องของคำขอ", 404, "NOT_FOUND");
    if (data.request.cancelledAt) throw new ConflictError("คำขอถูกยกเลิกแล้ว");
    const [job] = await db.select().from(printJobs).where(eq(printJobs.requestId, data.request.id));
    if (!job?.confirmedAt) throw new ConflictError("กรุณายืนยันไฟล์และจำนวนพิมพ์ก่อนสร้างใบปะหน้า");
    const allRooms = await db.select({ id: requestRooms.id }).from(requestRooms).where(eq(requestRooms.requestId, data.request.id)).orderBy(asc(requestRooms.id));
    if (
      ![
        REQUEST_STATUSES.CUTTING,
        REQUEST_STATUSES.PRINTING,
        REQUEST_STATUSES.PRINTED,
      ].includes(data.request.status as typeof REQUEST_STATUSES.CUTTING)
    ) {
      throw new ConflictError("สร้างใบปะหน้าได้ตั้งแต่สถานะตัดข้อสอบจนถึงพิมพ์เสร็จ");
    }

    const pdf = await createCoverPdf({
      courseCode: data.subject.courseCode,
      courseName: data.subject.courseName,
      facultyName: data.subject.facultyName,
      groupNo: data.subject.groupNo,
      examDate: data.room.examDate,
      startsAt: data.room.startsAt,
      endsAt: data.room.endsAt,
      roomName: data.room.roomName,
      studentCount: data.room.studentCount,
      reserveCount: data.room.reserveCount,
      printCount: data.room.printCount,
      submissionForm: data.request.submissionForm,
      envelopeNo: `${allRooms.findIndex((room) => room.id === data.room.id) + 1}/${allRooms.length}`,
      senderName: data.senderName,
      note: data.room.note,
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
          .select({ status: examRequests.status, cancelledAt: examRequests.cancelledAt })
          .from(examRequests)
          .where(eq(examRequests.id, data.request.id))
          .for("update")
          .limit(1);
        if (
          !lockedRequest || lockedRequest.cancelledAt ||
          ![
            REQUEST_STATUSES.CUTTING,
            REQUEST_STATUSES.PRINTING,
            REQUEST_STATUSES.PRINTED,
          ].includes(lockedRequest.status as typeof REQUEST_STATUSES.CUTTING)
        ) {
          throw new ConflictError("สถานะคำขอเปลี่ยนแล้ว ไม่สามารถสร้างใบปะหน้าได้");
        }
        const [currentJob] = await tx.select().from(printJobs).where(eq(printJobs.requestId, data.request.id));
        const [currentRoom] = await tx.select().from(requestRooms).where(eq(requestRooms.id, data.room.id));
        if (!currentJob || currentJob.revision !== job.revision || !currentRoom || currentRoom.printCount !== data.room.printCount || currentRoom.baseCopyCount !== data.room.baseCopyCount || currentRoom.reserveCount !== data.room.reserveCount) throw new ConflictError("จำนวนหรือไฟล์เปลี่ยนระหว่างสร้างใบปะหน้า กรุณาสร้างใหม่");
        const [instructor] = await tx.select({ name: user.name }).from(user).where(eq(user.id, data.request.instructorId)).for("share");
        if (instructor?.name !== data.senderName) throw new ConflictError("ชื่ออาจารย์เปลี่ยนระหว่างสร้างใบปะหน้า กรุณาสร้างใหม่");
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
            printRevision: job.revision,
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
          metadata: { requestRoomId: data.room.id, version, senderName: data.senderName },
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
