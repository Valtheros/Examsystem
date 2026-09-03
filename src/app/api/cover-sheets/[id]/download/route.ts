import { eq } from "drizzle-orm";

import { db } from "@/db";
import { coverSheets, examRequests, requestRooms } from "@/db/schema";
import { writeAuditLog, sessionActor } from "@/lib/audit";
import { AppError, AuthorizationError, errorResponse } from "@/lib/errors";
import { canViewRequest } from "@/lib/permissions";
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
      .select({ cover: coverSheets, request: examRequests })
      .from(coverSheets)
      .innerJoin(requestRooms, eq(coverSheets.requestRoomId, requestRooms.id))
      .innerJoin(examRequests, eq(requestRooms.requestId, examRequests.id))
      .where(eq(coverSheets.id, id))
      .limit(1);
    if (!record) throw new AppError("ไม่พบใบปะหน้า", 404, "NOT_FOUND");
    if (
      !canViewRequest({
        role: session.user.role,
        userId: session.user.id,
        instructorId: record.request.instructorId,
        status: record.request.status,
        cancelledAt: record.request.cancelledAt,
      })
    ) {
      throw new AuthorizationError();
    }
    await writeAuditLog({
      actor: sessionActor(session),
      action: "COVER_SHEET_DOWNLOADED",
      targetType: "cover_sheet",
      targetId: record.cover.id,
    });
    return Response.redirect(await createDownloadUrl(record.cover.storageKey), 302);
  } catch (error) {
    return errorResponse(error);
  }
}
