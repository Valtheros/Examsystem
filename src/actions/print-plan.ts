"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, examFiles, examRequests, printJobs, requestRooms } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { actionError, type ActionState } from "./types";

const schema = z.object({ requestId: z.uuid(), selectedExamFileId: z.uuid(), revision: z.number().int().min(0), reason: z.string().trim().max(1000),
  rooms: z.array(z.object({ id: z.uuid(), baseCopyCount: z.number().int().min(1).max(10000), reserveCount: z.number().int().min(0).max(10000) })).min(1),
});
export async function savePrintPlanAction(input: unknown): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.AV_UNIT]);
    const data = schema.parse(input);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      const [request] = await tx.select().from(examRequests).where(eq(examRequests.id, data.requestId)).for("update");
      if (!request || request.cancelledAt || request.status !== "ตัดข้อสอบ") throw new Error("แก้การเตรียมพิมพ์ได้เฉพาะก่อนเริ่มพิมพ์");
      const [job] = await tx.select().from(printJobs).where(eq(printJobs.requestId, request.id));
      if ((job?.revision ?? 0) !== data.revision) throw new Error("มีการแก้ไขงานนี้แล้ว กรุณารีเฟรชก่อนบันทึก");
      const [file] = await tx.select({ id: examFiles.id }).from(examFiles).where(and(eq(examFiles.id, data.selectedExamFileId), eq(examFiles.requestId, request.id)));
      if (!file) throw new Error("ไฟล์ไม่อยู่ในคำขอนี้");
      const oldRooms = await tx.select().from(requestRooms).where(eq(requestRooms.requestId, request.id));
      if (oldRooms.length !== data.rooms.length || new Set(data.rooms.map((room) => room.id)).size !== oldRooms.length) throw new Error("กรุณากรอกให้ครบทุกห้องโดยไม่ซ้ำ");
      let changed = job?.selectedExamFileId !== file.id;
      for (const row of data.rooms) {
        const old = oldRooms.find((room) => room.id === row.id);
        if (!old) throw new Error("ห้องไม่อยู่ในคำขอนี้");
        if (row.baseCopyCount !== old.studentCount && !data.reason) throw new Error("กรุณาระบุเหตุผลที่ปรับยอดหลักต่างจากยอดอาจารย์");
        changed ||= row.baseCopyCount !== old.baseCopyCount || row.reserveCount !== old.reserveCount;
        await tx.update(requestRooms).set({ baseCopyCount: row.baseCopyCount, reserveCount: row.reserveCount, printCount: row.baseCopyCount + row.reserveCount }).where(eq(requestRooms.id, row.id));
      }
      const values = { operatorId: session.user.id, selectedExamFileId: file.id, totalCopies: data.rooms.reduce((sum, row) => sum + row.baseCopyCount + row.reserveCount, 0), revision: job ? job.revision + (changed ? 1 : 0) : 1, confirmedAt: new Date(), updatedAt: new Date() };
      if (job) await tx.update(printJobs).set(values).where(eq(printJobs.id, job.id));
      else await tx.insert(printJobs).values({ ...values, requestId: request.id, status: "รอพิมพ์" });
      await tx.insert(auditLogs).values({ actorId: session.user.id, actorUsernameSnapshot: session.user.username, actorRoleSnapshot: session.user.role, action: "PRINT_PLAN_SAVED", targetType: "exam_request", targetId: request.id, metadata: { before: oldRooms.map((room) => ({ id: room.id, requested: room.studentCount, base: room.baseCopyCount, reserve: room.reserveCount })), after: data.rooms, reason: data.reason, previousFileId: job?.selectedExamFileId, selectedFileId: file.id, revision: values.revision } });
    });
    revalidatePath(`/dashboard/requests/${data.requestId}`);
    return { ok: true, message: "ยืนยันไฟล์และจำนวนแล้ว กรุณาสร้างใบปะหน้ารุ่นปัจจุบัน" };
  } catch (error) { return actionError(error); }
}
