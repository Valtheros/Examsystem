"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, lt, isNull, ne, sql } from "drizzle-orm";

import type { ActionState } from "@/actions/types";
import { actionError } from "@/actions/types";
import { db } from "@/db";
import { auditLogs, examRequests, examRooms, examRounds, rooms, subjects, user } from "@/db/schema";
import { writeAuditLog, sessionActor } from "@/lib/audit";
import { ROLES } from "@/lib/constants";
import { ConflictError } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import {
  examRoomSchema,
  examRoundSchema,
  roomSchema,
  subjectSchema,
} from "@/lib/validation";

export async function createExamRoundAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const parsed = examRoundSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }
    const [created] = await db
      .insert(examRounds)
      .values({
        ...parsed.data,
        submissionStartsOn: parsed.data.submissionStartsOn || null,
        submissionEndsOn: parsed.data.submissionEndsOn || null,
        createdBy: session.user.id,
      })
      .returning({ id: examRounds.id });
    await writeAuditLog({
      actor: sessionActor(session),
      action: "EXAM_ROUND_CREATED",
      targetType: "exam_round",
      targetId: created?.id,
      metadata: parsed.data,
    });
    revalidatePath("/dashboard/rounds");
    return { ok: true, message: "สร้างรอบสอบแล้ว" };
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
    const parsed = roomSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }
    const [created] = await db
      .insert(rooms)
      .values({ ...parsed.data, building: parsed.data.building || null })
      .returning({ id: rooms.id });
    await writeAuditLog({
      actor: sessionActor(session),
      action: "ROOM_CREATED",
      targetType: "room",
      targetId: created?.id,
      metadata: parsed.data,
    });
    revalidatePath("/dashboard/rooms");
    return { ok: true, message: "เพิ่มห้องสอบแล้ว" };
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
    const parsed = subjectSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }
    const [[round], [instructor]] = await Promise.all([
      db
        .select({ id: examRounds.id, isActive: examRounds.isActive })
        .from(examRounds)
        .where(eq(examRounds.id, parsed.data.roundId))
        .limit(1),
      db
        .select({ id: user.id, role: user.role, banned: user.banned })
        .from(user)
        .where(eq(user.id, parsed.data.instructorId))
        .limit(1),
    ]);
    if (!round?.isActive) throw new ConflictError("กรุณาเลือกรอบสอบที่เปิดใช้งาน");
    if (!instructor || instructor.role !== ROLES.INSTRUCTOR || instructor.banned) {
      throw new ConflictError("ผู้รับผิดชอบต้องเป็นอาจารย์ที่เปิดใช้งานอยู่");
    }
    const subjectId = String(formData.get("editSubjectId") || "");
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      if (subjectId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subject:${subjectId}`}))`);
        const [active] = await tx.select({ id: examRequests.id }).from(examRequests).where(and(eq(examRequests.subjectId, subjectId), isNull(examRequests.cancelledAt)));
        if (active) throw new ConflictError("วิชานี้มีคำขอแล้ว ไม่สามารถแก้ข้อมูลย้อนหลังได้");
      }
      const [row] = subjectId ? await tx.update(subjects).set(parsed.data).where(eq(subjects.id, subjectId)).returning({ id: subjects.id }) : await tx.insert(subjects).values(parsed.data).returning({ id: subjects.id });
      if (!row) throw new ConflictError("ไม่พบรายวิชา");
      return row;
    });
    await writeAuditLog({
      actor: sessionActor(session),
      action: subjectId ? "SUBJECT_UPDATED" : "SUBJECT_CREATED",
      targetType: "subject",
      targetId: created?.id,
      metadata: {
        courseCode: parsed.data.courseCode,
        facultyName: parsed.data.facultyName,
        groupNo: parsed.data.groupNo,
      },
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
    const editId = String(formData.get("examRoomId") || "");
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
        ? await tx.update(examRooms).set(values).where(eq(examRooms.id, editId)).returning({ id: examRooms.id })
        : await tx.insert(examRooms).values(values).returning({ id: examRooms.id });
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username, actorRoleSnapshot: session.user.role, action: editId ? "EXAM_ROOM_UPDATED" : "EXAM_ROOM_ASSIGNED", targetType: "exam_room", targetId: saved.id, metadata: data });
    });
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: "บันทึกตารางสอบแล้ว" };
  } catch (error) { return actionError(error); }
}
