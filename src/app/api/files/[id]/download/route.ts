import { eq } from "drizzle-orm";

import { db } from "@/db";
import { examFiles, examRequests } from "@/db/schema";
import { writeAuditLog, sessionActor } from "@/lib/audit";
import { AppError, AuthorizationError, errorResponse } from "@/lib/errors";
import { canDownloadExamFile } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { createDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const [record] = await db
      .select({ file: examFiles, request: examRequests })
      .from(examFiles)
      .innerJoin(examRequests, eq(examFiles.requestId, examRequests.id))
      .where(eq(examFiles.id, id))
      .limit(1);
    if (!record) throw new AppError("ไม่พบไฟล์", 404, "NOT_FOUND");
    if (
      !canDownloadExamFile({
        role: session.user.role,
        userId: session.user.id,
        instructorId: record.request.instructorId,
        status: record.request.status,
        cancelledAt: record.request.cancelledAt,
      })
    ) {
      throw new AuthorizationError("ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้ในสถานะปัจจุบัน");
    }

    await writeAuditLog({
      actor: sessionActor(session),
      action: "EXAM_FILE_DOWNLOADED",
      targetType: "exam_file",
      targetId: record.file.id,
      metadata: {
        requestId: record.request.id,
        version: record.file.version,
      },
    });
    const url = await createDownloadUrl(record.file.storageKey);
    return Response.redirect(url, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
