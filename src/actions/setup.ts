"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, lt } from "drizzle-orm";

import type { ActionState } from "@/actions/types";
import { actionError } from "@/actions/types";
import { db } from "@/db";
import { examRooms, examRounds, rooms, subjects, user } from "@/db/schema";
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
    const [created] = await db
      .insert(subjects)
      .values(parsed.data)
      .returning({ id: subjects.id });
    await writeAuditLog({
      actor: sessionActor(session),
      action: "SUBJECT_CREATED",
      targetType: "subject",
      targetId: created?.id,
      metadata: {
        courseCode: parsed.data.courseCode,
        groupNo: parsed.data.groupNo,
      },
    });
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: "เพิ่มรายวิชาแล้ว" };
  } catch (error) {
    return actionError(error);
  }
}

export async function assignExamRoomAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.OFFICER]);
    const parsed = examRoomSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }
    const startsAt = `${parsed.data.startsAt}:00`;
    const endsAt = `${parsed.data.endsAt}:00`;
    const [room] = await db
      .select({ capacity: rooms.capacity, isActive: rooms.isActive })
      .from(rooms)
      .where(eq(rooms.id, parsed.data.roomId))
      .limit(1);
    if (!room?.isActive) throw new ConflictError("กรุณาเลือกห้องที่เปิดใช้งาน");
    if (parsed.data.studentCount > room.capacity) {
      throw new ConflictError("จำนวนผู้เข้าสอบมากกว่าความจุของห้อง");
    }
    const [overlap] = await db
      .select({ id: examRooms.id })
      .from(examRooms)
      .where(
        and(
          eq(examRooms.roomId, parsed.data.roomId),
          eq(examRooms.examDate, parsed.data.examDate),
          lt(examRooms.startsAt, endsAt),
          gt(examRooms.endsAt, startsAt),
        ),
      )
      .limit(1);
    if (overlap) throw new ConflictError("ห้องนี้มีตารางสอบซ้อนกับช่วงเวลาที่เลือก");
    const [created] = await db
      .insert(examRooms)
      .values({
        ...parsed.data,
        startsAt,
        endsAt,
        note: parsed.data.note || null,
      })
      .returning({ id: examRooms.id });
    await writeAuditLog({
      actor: sessionActor(session),
      action: "EXAM_ROOM_ASSIGNED",
      targetType: "exam_room",
      targetId: created?.id,
      metadata: parsed.data,
    });
    revalidatePath("/dashboard/subjects");
    return { ok: true, message: "เพิ่มห้องและเวลาสอบให้รายวิชาแล้ว" };
  } catch (error) {
    return actionError(error);
  }
}
