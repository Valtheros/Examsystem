import { ne, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
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
}) {
  await db.insert(auditLogs).values({
    actorId: currentUser.id,
    actorUsernameSnapshot: currentUser.username,
    actorRoleSnapshot: currentUser.role,
    action: "FACTORY_RESET_STARTED",
    targetType: "system",
    metadata: {},
  });

  try {
    await db.transaction(async (tx) => {
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
      await tx.delete(verification);
      await tx.delete(sessionTable).where(ne(sessionTable.userId, currentUser.id));
      await tx.delete(account).where(ne(account.userId, currentUser.id));
      await tx.delete(user).where(ne(user.id, currentUser.id));
    });
    await db.insert(auditLogs).values({
      actorId: currentUser.id,
      actorUsernameSnapshot: currentUser.username,
      actorRoleSnapshot: currentUser.role,
      action: "FACTORY_RESET_DATABASE_COMPLETED",
      targetType: "system",
      metadata: {},
    });
  } catch (error) {
    await db.insert(auditLogs).values({
      actorId: currentUser.id,
      actorUsernameSnapshot: currentUser.username,
      actorRoleSnapshot: currentUser.role,
      action: "FACTORY_RESET_FAILED",
      targetType: "system",
      metadata: {
        phase: "database",
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

    if (!input.storageOnly) {
      await resetDatabase({
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
      });
    }

    try {
      const deletedFiles = await purgeAllPrivateObjects();
      await db.insert(auditLogs).values({
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
        action: input.storageOnly
          ? "FACTORY_RESET_STORAGE_RETRY_COMPLETED"
          : "FACTORY_RESET_COMPLETED",
        targetType: "system",
        metadata: { deletedFiles },
      });
      return Response.json({ ok: true, deletedFiles });
    } catch (storageError) {
      const message =
        storageError instanceof Error ? storageError.message : "unknown";
      await db.insert(auditLogs).values({
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
        action: "FACTORY_RESET_STORAGE_FAILED",
        targetType: "system",
        metadata: { error: message },
      });
      return Response.json(
        {
          ok: false,
          databaseReset: !input.storageOnly,
          storagePending: true,
          message:
            "ล้างฐานข้อมูลแล้ว แต่ลบไฟล์บางส่วนไม่สำเร็จ กรุณากดล้างไฟล์ตกค้างซ้ำ",
        },
        { status: 207 },
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
