import { ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import postgres from "postgres";
import { ZodError } from "zod";

import { databaseUrl, db } from "@/db";
import * as schema from "@/db/schema";
import {
  account,
  auditLogs,
  coverSheets,
  examFiles,
  examRequests,
  examRooms,
  examRounds,
  notifications,
  printJobs,
  requestRooms,
  requestStatusHistory,
  rooms,
  session as sessionTable,
  subjects,
  user,
  verification,
} from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { AppError, errorResponse } from "@/lib/errors";
import { purgeAllPrivateObjects } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/session";
import { factoryResetSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

async function resetDatabase(currentUser: {
  id: string;
  username: string;
  role: string;
}, scope: "system" | "exam-data", database: typeof db) {
  const action = scope === "exam-data" ? "EXAM_DATA_CLEAR" : "FACTORY_RESET";
  await database.insert(auditLogs).values({
    actorId: currentUser.id,
    actorUsernameSnapshot: currentUser.username,
    actorRoleSnapshot: currentUser.role,
    action: `${action}_STARTED`,
    targetType: "system",
    metadata: { scope, preserveAllUsers: scope === "exam-data" },
  });

  try {
    await database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(921001)`);
      await tx.delete(coverSheets);
      await tx.delete(printJobs);
      await tx.delete(examFiles);
      await tx.delete(requestStatusHistory);
      await tx.delete(notifications);
      await tx.delete(requestRooms);
      await tx.delete(examRequests);
      await tx.delete(examRooms);
      await tx.delete(subjects);
      await tx.delete(rooms);
      await tx.delete(examRounds);
      if (scope === "system") {
        await tx.delete(verification);
        await tx.delete(sessionTable).where(ne(sessionTable.userId, currentUser.id));
        await tx.delete(account).where(ne(account.userId, currentUser.id));
        await tx.delete(user).where(ne(user.id, currentUser.id));
      }
    });
    await database.insert(auditLogs).values({
      actorId: currentUser.id,
      actorUsernameSnapshot: currentUser.username,
      actorRoleSnapshot: currentUser.role,
      action: `${action}_DATABASE_COMPLETED`,
      targetType: "system",
      metadata: { scope },
    });
  } catch (error) {
    await database.insert(auditLogs).values({
      actorId: currentUser.id,
      actorUsernameSnapshot: currentUser.username,
      actorRoleSnapshot: currentUser.role,
      action: `${action}_FAILED`,
      targetType: "system",
      metadata: {
        phase: "database",
        scope,
        error: error instanceof Error ? error.message : "unknown",
      },
    });
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole([ROLES.ADMIN]);
    const input = factoryResetSchema.parse(await request.json());
    const verified = await auth.api.verifyPassword({
      headers: await headers(),
      body: { password: input.currentPassword },
    });
    if (!verified.status) {
      throw new AppError("รหัสผ่านปัจจุบันไม่ถูกต้อง", 422, "INVALID_PASSWORD");
    }

    // Keep the reset lock through file deletion, even after the database commits.
    // ponytail: one global maintenance lock; use scoped locks only if resets become frequent.
    // A single dedicated connection keeps the session lock across separate commits.
    const connection = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 0, max_lifetime: 0, connect_timeout: 10 });
    let locked = false;
    try {
      const [lock] = await connection`select pg_try_advisory_lock(921001) as acquired`;
      locked = lock.acquired;
      if (!locked) throw new AppError("ระบบกำลังล้างข้อมูลอยู่ กรุณารอให้เสร็จก่อน", 409, "RESET_IN_PROGRESS");
      const database = drizzle(connection, { schema });
      const action = input.scope === "exam-data" ? "EXAM_DATA_CLEAR" : "FACTORY_RESET";

      if (input.storageOnly) {
        const [newRequest] = await database.select({ id: examRequests.id }).from(examRequests).limit(1);
        if (newRequest) throw new AppError("มีคำขอใหม่ในระบบแล้ว จึงไม่ล้างไฟล์ตกค้างเพื่อป้องกันไฟล์ของงานใหม่ถูกลบ", 409, "NEW_EXAM_DATA_EXISTS");
      } else {
        await resetDatabase({
          id: session.user.id,
          username: session.user.username,
          role: session.user.role,
        }, input.scope, database);
      }

      try {
        const deletedFiles = await purgeAllPrivateObjects();
        await database.insert(auditLogs).values({
          actorId: session.user.id,
          actorUsernameSnapshot: session.user.username,
          actorRoleSnapshot: session.user.role,
          action: `${action}_${input.storageOnly ? "STORAGE_RETRY_COMPLETED" : "COMPLETED"}`,
          targetType: "system",
          metadata: { scope: input.scope, deletedFiles },
        });
        return Response.json({ ok: true, deletedFiles });
      } catch (storageError) {
        await database.insert(auditLogs).values({
          actorId: session.user.id,
          actorUsernameSnapshot: session.user.username,
          actorRoleSnapshot: session.user.role,
          action: `${action}_STORAGE_FAILED`,
          targetType: "system",
          metadata: { scope: input.scope, error: storageError instanceof Error ? storageError.message : "unknown" },
        });
        return Response.json({
          ok: false,
          databaseReset: !input.storageOnly,
          storagePending: true,
          message: "ล้างข้อมูลงานสอบแล้ว แต่ลบไฟล์บางส่วนไม่สำเร็จ กรุณาลองล้างไฟล์ตกค้างอีกครั้ง",
        }, { status: 207 });
      }
    } finally {
      try {
        if (locked) await connection`select pg_advisory_unlock(921001)`;
      } finally {
        await connection.end();
      }
    }
  } catch (error) {
    if (error instanceof ZodError) return errorResponse(new AppError(error.issues[0]?.message ?? "กรุณาตรวจสอบข้อมูลยืนยัน", 422, "INVALID_CONFIRMATION"));
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") return errorResponse(new AppError("รหัสผ่านปัจจุบันไม่ถูกต้อง", 422, "INVALID_PASSWORD"));
    if (error instanceof APIError && error.statusCode === 401) return errorResponse(new AppError("กรุณาเข้าสู่ระบบใหม่ก่อนยืนยันล้างข้อมูล", 401, "FRESH_SESSION_REQUIRED"));
    return errorResponse(error);
  }
}
