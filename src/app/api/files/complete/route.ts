import { and, eq, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, examFiles, examRequests } from "@/db/schema";
import { MAX_EXAM_FILE_BYTES } from "@/lib/constants";
import { AppError, AuthorizationError, errorResponse } from "@/lib/errors";
import { canUploadExamFile } from "@/lib/permissions";
import { getAuthorizedRequest } from "@/lib/request-access";
import { requireSession } from "@/lib/session";
import { deletePrivateObject, inspectPdfObject } from "@/lib/storage";
import { completeUploadSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = completeUploadSchema.parse(await request.json());
    if (!input.storageKey.startsWith(`exam-files/${input.requestId}/`)) {
      throw new AppError("ตำแหน่งไฟล์ไม่ถูกต้อง", 422, "INVALID_STORAGE_KEY");
    }
    const examRequest = await getAuthorizedRequest(input.requestId, session);
    if (
      !canUploadExamFile(
        {
          role: session.user.role,
          userId: session.user.id,
          instructorId: examRequest.instructorId,
          status: examRequest.status,
          cancelledAt: examRequest.cancelledAt,
        },
        input.kind,
      )
    ) {
      throw new AuthorizationError("สถานะหรือบทบาทปัจจุบันไม่อนุญาตให้บันทึกไฟล์");
    }

    const object = await inspectPdfObject(input.storageKey);
    if (
      object.contentLength !== input.fileSize ||
      object.contentLength > MAX_EXAM_FILE_BYTES ||
      object.contentType !== "application/pdf" ||
      object.sha256.toLowerCase() !== input.sha256.toLowerCase() ||
      object.declaredSha256.toLowerCase() !== input.sha256.toLowerCase()
    ) {
      await deletePrivateObject(input.storageKey).catch(() => undefined);
      throw new AppError("ข้อมูลไฟล์ใน Storage ไม่ตรงกับข้อมูลที่ลงนามไว้", 422, "FILE_MISMATCH");
    }

    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      const [lockedRequest] = await tx
        .select()
        .from(examRequests)
        .where(eq(examRequests.id, input.requestId))
        .for("update")
        .limit(1);
      if (
        !lockedRequest ||
        !canUploadExamFile(
          {
            role: session.user.role,
            userId: session.user.id,
            instructorId: lockedRequest.instructorId,
            status: lockedRequest.status,
            cancelledAt: lockedRequest.cancelledAt,
          },
          input.kind,
        )
      ) {
        throw new AuthorizationError(
          "สถานะคำขอเปลี่ยนแล้วและไม่อนุญาตให้บันทึกไฟล์",
        );
      }
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${input.requestId}:${input.kind}`}))`,
      );
      const [latest] = await tx
        .select({ version: max(examFiles.version) })
        .from(examFiles)
        .where(
          and(
            eq(examFiles.requestId, input.requestId),
            eq(examFiles.kind, input.kind),
          ),
        );
      const version = (latest?.version ?? 0) + 1;
      const [file] = await tx
        .insert(examFiles)
        .values({
          requestId: input.requestId,
          uploadedBy: session.user.id,
          kind: input.kind,
          originalFileName: input.fileName,
          storageKey: input.storageKey,
          contentType: input.contentType,
          sizeBytes: input.fileSize,
          sha256: input.sha256.toLowerCase(),
          version,
        })
        .returning();
      if (!file) throw new Error("บันทึกไฟล์ไม่สำเร็จ");
      await tx.insert(auditLogs).values({
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
        action: "EXAM_FILE_UPLOADED",
        targetType: "exam_file",
        targetId: file.id,
        metadata: {
          requestId: input.requestId,
          kind: input.kind,
          version,
          sizeBytes: input.fileSize,
          sha256: input.sha256.toLowerCase(),
        },
      });
      return file;
    });
    return Response.json({ ok: true, file: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
