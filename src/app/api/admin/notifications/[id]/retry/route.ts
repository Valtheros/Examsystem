import { eq } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { writeAuditLog, sessionActor } from "@/lib/audit";
import { ROLES } from "@/lib/constants";
import { AppError, errorResponse } from "@/lib/errors";
import { sendQueuedEmail } from "@/lib/mail";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole([ROLES.ADMIN]);
    const { id } = await params;
    const [notification] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    if (!notification) throw new AppError("ไม่พบรายการแจ้งเตือน", 404, "NOT_FOUND");
    const result = await sendQueuedEmail(id);
    await writeAuditLog({
      actor: sessionActor(session),
      action: "EMAIL_RETRIED",
      targetType: "notification",
      targetId: id,
      metadata: { result: result.status },
    });
    return Response.json({ ok: result.status === "Sent", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
