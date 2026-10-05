"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, examRequests, examRooms, examRounds, requestRooms, requestStatusHistory, rooms, subjects } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { canEditRequest } from "@/lib/permissions";
import { draftSubmissionFormSchema, requestedRoomsSchema, validateRequestedRooms } from "@/lib/submission-form";
import { actionError, type ActionState } from "./types";

const draftSchema = z.object({
  requestId: z.uuid().optional(), subjectId: z.uuid(), pageCount: z.number().int().min(1).max(1000),
  submissionForm: draftSubmissionFormSchema,
  roomCounts: requestedRoomsSchema,
});

export async function saveSubmissionAction(input: unknown): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.INSTRUCTOR]);
    const data = draftSchema.parse(input);
    const requestId = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      // Same lock as timetable edits: the snapshot cannot miss a concurrent room assignment.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subject:${data.subjectId}`}))`);
      const [subject] = await tx.select({ id: subjects.id }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id))
        .where(and(eq(subjects.id, data.subjectId), eq(subjects.instructorId, session.user.id), eq(examRounds.isActive, true))).limit(1);
      if (!subject) throw new Error("ไม่พบรายวิชาของคุณในรอบสอบที่เปิดใช้งาน");
      // Same subject -> sorted rooms lock order as scheduling; capacity edits cannot race this snapshot.
      const assigned = await tx.select({ roomId: examRooms.roomId }).from(examRooms).where(eq(examRooms.subjectId, subject.id));
      for (const roomId of [...new Set(assigned.map(row => row.roomId))].sort()) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`room:${roomId}`}))`);
      }
      const schedules = await tx.select({ examRoomId: examRooms.id, capacity: rooms.capacity, roomCode: rooms.code, roomName: rooms.name, building: rooms.building, examDate: examRooms.examDate, startsAt: examRooms.startsAt, endsAt: examRooms.endsAt, note: examRooms.note }).from(examRooms).innerJoin(rooms, eq(examRooms.roomId, rooms.id)).where(eq(examRooms.subjectId, subject.id));
      validateRequestedRooms(data.roomCounts, schedules);
      let id = data.requestId;
      if (id) {
        const [request] = await tx.select().from(examRequests).where(eq(examRequests.id, id)).for("update");
        if (!request || request.subjectId !== subject.id || !canEditRequest({ role: session.user.role, userId: session.user.id, instructorId: request.instructorId, status: request.status, cancelledAt: request.cancelledAt })) throw new Error("คำขอนี้แก้ไขไม่ได้แล้ว");
        await tx.update(examRequests).set({ pageCount: data.pageCount, submissionForm: data.submissionForm, updatedAt: new Date() }).where(eq(examRequests.id, id));
      } else {
        const [existing] = await tx.select({ id: examRequests.id }).from(examRequests).where(and(eq(examRequests.subjectId, subject.id), isNull(examRequests.cancelledAt)));
        if (existing) throw new Error("วิชานี้มีคำขออยู่แล้ว กรุณาเปิดคำขอเดิมจากรายการของคุณ");
        const [created] = await tx.insert(examRequests).values({ requestNo: `REQ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`, subjectId: subject.id, instructorId: session.user.id, pageCount: data.pageCount, submissionForm: data.submissionForm }).returning({ id: examRequests.id });
        id = created.id;
        await tx.insert(requestStatusHistory).values({ requestId: id, toStatus: "ฉบับร่าง", actorId: session.user.id, actorUsernameSnapshot: session.user.username, actorRoleSnapshot: session.user.role });
      }
      for (const schedule of schedules) {
        const count = data.roomCounts.find((row) => row.examRoomId === schedule.examRoomId)!.count;
        await tx.insert(requestRooms).values({ ...schedule, requestId: id, studentCount: count, baseCopyCount: count, reserveCount: 1, printCount: count + 1, senderName: session.user.name })
          .onConflictDoUpdate({ target: [requestRooms.requestId, requestRooms.examRoomId], set: { studentCount: count, baseCopyCount: count, reserveCount: 1, printCount: count + 1 } });
      }
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username, actorRoleSnapshot: session.user.role, action: data.requestId ? "REQUEST_UPDATED" : "REQUEST_CREATED", targetType: "exam_request", targetId: id, metadata: { roomCounts: data.roomCounts, submissionForm: data.submissionForm } });
      return id;
    });
    revalidatePath("/dashboard/requests");
    revalidatePath(`/dashboard/requests/${requestId}`);
    return { ok: true, message: "บันทึกฉบับร่างแล้ว", requestId };
  } catch (error) { return actionError(error); }
}
