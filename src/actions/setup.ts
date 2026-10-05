"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, lt, isNull, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";

import type { ActionState } from "@/actions/types";
import { actionError } from "@/actions/types";
import { db } from "@/db";
import { auditLogs, examRequests, examRooms, examRounds, requestRooms, rooms, subjects, user } from "@/db/schema";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { ConflictError } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import {
  examRoomSchema,
  examRoundSchema,
  roomSchema,
  subjectSchema,
} from "@/lib/validation";

async function lockUnusedRound(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], id: string) {
  // Round -> sorted subjects -> rooms. Subject creation takes the round lock too.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`round:${id}`}))`);
  const [round] = await tx.select().from(examRounds).where(eq(examRounds.id, id)).for("update");
  if (!round) throw new ConflictError("ไม่พบรอบสอบ");
  const linked = await tx.select().from(subjects).where(eq(subjects.roundId, id)).orderBy(asc(subjects.id));
  for (const subject of linked) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subject:${subject.id}`}))`);
  }
  const [used] = await tx.select({ id: examRequests.id }).from(examRequests)
    .innerJoin(subjects, eq(examRequests.subjectId, subjects.id)).where(eq(subjects.roundId, id)).limit(1);
  if (used) throw new ConflictError("รอบสอบนี้มีประวัติคำขอแล้ว จึงแก้ไขหรือลบไม่ได้ เพื่อรักษาคำขอและไฟล์เดิม");
  return { ...round, subjects: linked };
}

export async function createExamRoundAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const data = examRoundSchema.parse(Object.fromEntries(formData));
    const editId = formData.get("editRoundId") ? z.uuid().parse(formData.get("editRoundId")) : "";
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      const previous = editId ? await lockUnusedRound(tx, editId) : undefined;
      const [duplicate] = await tx.select({ id: examRounds.id }).from(examRounds).where(and(
        eq(examRounds.name, data.name), eq(examRounds.academicYear, data.academicYear),
        eq(examRounds.semester, data.semester), editId ? ne(examRounds.id, editId) : undefined,
      )).limit(1);
      if (duplicate) throw new ConflictError("มีรอบสอบชื่อนี้ในปีและภาคการศึกษานี้แล้ว");
      const values = { ...data, submissionStartsOn: data.submissionStartsOn || null, submissionEndsOn: data.submissionEndsOn || null };
      const [saved] = editId
        ? await tx.update(examRounds).set({ ...values, updatedAt: new Date() }).where(eq(examRounds.id, editId)).returning({ id: examRounds.id })
        : await tx.insert(examRounds).values({ ...values, createdBy: session.user.id }).returning({ id: examRounds.id });
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role, action: editId ? "EXAM_ROUND_UPDATED" : "EXAM_ROUND_CREATED",
        targetType: "exam_round", targetId: saved.id, metadata: { previous, ...data } });
    });
    revalidatePath("/dashboard/rounds");
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: editId ? "บันทึกการแก้ไขรอบสอบแล้ว" : "สร้างรอบสอบแล้ว" };
  } catch (error) {
    return actionError(error);
  }
}

export async function createRoomAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const data = roomSchema.parse(Object.fromEntries(formData));
    const editId = formData.get("editRoomId") ? z.uuid().parse(formData.get("editRoomId")) : "";
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      let previous;
      if (editId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`room:${editId}`}))`);
        [previous] = await tx.select().from(rooms).where(eq(rooms.id, editId)).for("update");
        if (!previous) throw new ConflictError("ไม่พบห้องสอบที่ต้องการแก้ไข");
        const [pending] = await tx.select({ count: requestRooms.studentCount }).from(requestRooms)
          .innerJoin(examRooms, eq(requestRooms.examRoomId, examRooms.id))
          .innerJoin(examRequests, eq(requestRooms.requestId, examRequests.id))
          .where(and(eq(examRooms.roomId, editId), isNull(examRequests.cancelledAt),
            inArray(examRequests.status, [REQUEST_STATUSES.DRAFT, REQUEST_STATUSES.PENDING_REVIEW, REQUEST_STATUSES.RETURNED]),
            gt(requestRooms.studentCount, data.capacity))).limit(1);
        if (pending) throw new ConflictError(`ห้องนี้มีคำขอ ${pending.count} ชุดอยู่แล้ว ไม่สามารถลดความจุให้ต่ำกว่าจำนวนในคำขอได้`);
      }
      const values = { ...data, building: data.building || null };
      const [saved] = editId
        ? await tx.update(rooms).set({ ...values, updatedAt: new Date() }).where(eq(rooms.id, editId)).returning({ id: rooms.id })
        : await tx.insert(rooms).values(values).returning({ id: rooms.id });
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role, action: editId ? "ROOM_UPDATED" : "ROOM_CREATED",
        targetType: "room", targetId: saved.id, metadata: { previous, ...data } });
    });
    revalidatePath("/dashboard/rooms");
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: editId ? "บันทึกการแก้ไขห้องสอบแล้ว" : "เพิ่มห้องสอบแล้ว" };
  } catch (error) {
    return actionError(error);
  }
}

export async function createSubjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const data = subjectSchema.parse(Object.fromEntries(formData));
    const [instructor] = await db
        .select({ id: user.id, role: user.role, banned: user.banned })
        .from(user)
        .where(eq(user.id, data.instructorId))
        .limit(1);
    if (!instructor || instructor.role !== ROLES.INSTRUCTOR || instructor.banned) {
      throw new ConflictError("ผู้รับผิดชอบต้องเป็นอาจารย์ที่เปิดใช้งานอยู่");
    }
    const subjectId = formData.get("editSubjectId") ? z.uuid().parse(formData.get("editSubjectId")) : "";
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`round:${data.roundId}`}))`);
      const [round] = await tx.select().from(examRounds).where(eq(examRounds.id, data.roundId));
      if (!round?.isActive) throw new ConflictError("กรุณาเลือกรอบสอบที่เปิดใช้งาน");
      if (subjectId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subject:${subjectId}`}))`);
        const [active] = await tx.select({ id: examRequests.id }).from(examRequests).where(and(eq(examRequests.subjectId, subjectId), isNull(examRequests.cancelledAt)));
        if (active) throw new ConflictError("วิชานี้มีคำขอแล้ว ไม่สามารถแก้ข้อมูลย้อนหลังได้");
      }
      const [row] = subjectId ? await tx.update(subjects).set({ ...data, updatedAt: new Date() }).where(eq(subjects.id, subjectId)).returning({ id: subjects.id }) : await tx.insert(subjects).values(data).returning({ id: subjects.id });
      if (!row) throw new ConflictError("ไม่พบรายวิชา");
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role, action: subjectId ? "SUBJECT_UPDATED" : "SUBJECT_CREATED",
        targetType: "subject", targetId: row.id, metadata: data });
    });
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: subjectId ? "บันทึกการแก้ไขรายวิชาแล้ว" : "เพิ่มรายวิชาแล้ว" };
  } catch (error) {
    return actionError(error);
  }
}

export async function assignExamRoomAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const data = examRoomSchema.parse(Object.fromEntries(formData));
    const editId = formData.get("examRoomId") ? z.uuid().parse(formData.get("examRoomId")) : "";
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subject:${data.subjectId}`}))`);
      const [subject] = await tx.select({ id: subjects.id }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).where(and(eq(subjects.id, data.subjectId), eq(examRounds.isActive, true)));
      if (!subject) throw new ConflictError("กรุณาเลือกวิชาในรอบสอบที่เปิดใช้งาน");
      const [active] = await tx.select({ id: examRequests.id }).from(examRequests).where(and(eq(examRequests.subjectId, subject.id), isNull(examRequests.cancelledAt)));
      if (active) throw new ConflictError("วิชานี้มีคำขอแล้ว ไม่สามารถเปลี่ยนตารางสอบย้อนหลังได้");
      // Serialize all reservations for a physical room, including different subjects.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`room:${data.roomId}`}))`);
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, data.roomId));
      if (!room?.isActive) throw new ConflictError("กรุณาเลือกห้องที่เปิดใช้งาน");
      if (editId) {
        const [existing] = await tx.select().from(examRooms).where(and(eq(examRooms.id, editId), eq(examRooms.subjectId, subject.id)));
        if (!existing) throw new ConflictError("ไม่พบตารางสอบของวิชานี้");
      }
      const startsAt = `${data.startsAt}:00`;
      const endsAt = `${data.endsAt}:00`;
      const [overlap] = await tx.select({ id: examRooms.id }).from(examRooms).where(and(
        eq(examRooms.roomId, data.roomId), eq(examRooms.examDate, data.examDate),
        lt(examRooms.startsAt, endsAt), gt(examRooms.endsAt, startsAt),
        editId ? ne(examRooms.id, editId) : undefined,
      ));
      if (overlap) throw new ConflictError("ห้องนี้มีตารางสอบซ้อนกับช่วงเวลาที่เลือก");
      const values = { ...data, startsAt, endsAt, note: data.note || null };
      const [saved] = editId
        ? await tx.update(examRooms).set({ ...values, updatedAt: new Date() }).where(eq(examRooms.id, editId)).returning({ id: examRooms.id })
        : await tx.insert(examRooms).values(values).returning({ id: examRooms.id });
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username, actorRoleSnapshot: session.user.role, action: editId ? "EXAM_ROOM_UPDATED" : "EXAM_ROOM_ASSIGNED", targetType: "exam_room", targetId: saved.id, metadata: data });
    });
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: "บันทึกตารางสอบแล้ว" };
  } catch (error) { return actionError(error); }
}

export async function deleteSetupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const { kind, id } = z.object({ kind: z.enum(["round", "room", "subject", "schedule"]), id: z.uuid() }).parse(Object.fromEntries(formData));
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      let previous;
      if (kind === "round") {
        previous = await lockUnusedRound(tx, id);
        await tx.delete(examRounds).where(eq(examRounds.id, id)); // Only unused subjects/timetables cascade; requests use RESTRICT.
      } else if (kind === "room") {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`room:${id}`}))`);
        [previous] = await tx.select().from(rooms).where(eq(rooms.id, id)).for("update");
        if (!previous) throw new ConflictError("ไม่พบห้องสอบ");
        const [used] = await tx.select({ id: examRooms.id }).from(examRooms).where(eq(examRooms.roomId, id)).limit(1);
        if (used) throw new ConflictError("ห้องนี้มีตารางสอบอยู่ กรุณาลบตารางที่ยังไม่ถูกใช้งานก่อนลบห้อง");
        await tx.delete(rooms).where(eq(rooms.id, id));
      } else {
        const [schedule] = kind === "schedule" ? await tx.select().from(examRooms).where(eq(examRooms.id, id)) : [];
        if (kind === "schedule" && !schedule) throw new ConflictError("ไม่พบตารางสอบ");
        const subjectId = schedule?.subjectId ?? id;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subject:${subjectId}`}))`);
        const [request] = await tx.select({ id: examRequests.id }).from(examRequests).where(and(eq(examRequests.subjectId, subjectId), kind === "schedule" ? isNull(examRequests.cancelledAt) : undefined)).limit(1);
        if (request) throw new ConflictError(kind === "subject" ? "รายวิชานี้มีประวัติคำขอแล้ว จึงลบไม่ได้เพื่อรักษาคำขอและไฟล์เดิม" : "รายวิชานี้มีคำขออยู่แล้ว จึงลบตารางสอบไม่ได้");
        if (kind === "subject") {
          [previous] = await tx.select().from(subjects).where(eq(subjects.id, id)).for("update");
          if (!previous) throw new ConflictError("ไม่พบรายวิชา");
          await tx.delete(subjects).where(eq(subjects.id, id)); // Cascades only unused timetable rows; requests use RESTRICT.
        } else {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`room:${schedule!.roomId}`}))`);
          const [used] = await tx.select({ id: requestRooms.id }).from(requestRooms).where(eq(requestRooms.examRoomId, id)).limit(1);
          if (used) throw new ConflictError("ตารางนี้ถูกอ้างอิงในประวัติคำขอแล้ว จึงลบไม่ได้");
          [previous] = await tx.delete(examRooms).where(and(eq(examRooms.id, id), eq(examRooms.subjectId, subjectId))).returning();
          if (!previous) throw new ConflictError("ไม่พบตารางสอบ");
        }
      }
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role, action: `${kind === "schedule" ? "EXAM_ROOM" : kind === "round" ? "EXAM_ROUND" : kind.toUpperCase()}_DELETED`,
        targetType: kind === "schedule" ? "exam_room" : kind === "round" ? "exam_round" : kind, targetId: id, metadata: { previous } });
    });
    revalidatePath("/dashboard/rounds");
    revalidatePath("/dashboard/rooms");
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: "ลบรายการแล้ว" };
  } catch (error) { return actionError(error); }
}
