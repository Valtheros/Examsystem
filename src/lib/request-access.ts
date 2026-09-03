import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { examRequests } from "@/db/schema";
import { AppError, AuthorizationError } from "@/lib/errors";
import { canViewRequest } from "@/lib/permissions";
import type { AppSession } from "@/lib/session";

export async function getAuthorizedRequest(
  requestId: string,
  session: AppSession,
) {
  const [request] = await db
    .select()
    .from(examRequests)
    .where(eq(examRequests.id, requestId))
    .limit(1);
  if (!request) throw new AppError("ไม่พบคำขอ", 404, "NOT_FOUND");
  if (
    !canViewRequest({
      role: session.user.role,
      userId: session.user.id,
      instructorId: request.instructorId,
      status: request.status,
      cancelledAt: request.cancelledAt,
    })
  ) {
    throw new AuthorizationError();
  }
  return request;
}
