import "server-only";

import { headers } from "next/headers";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { AppRole } from "@/lib/constants";

type AuditActor = {
  id: string | null;
  username: string;
  role: AppRole | string;
};

type AuditInput = {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput) {
  const requestHeaders = await headers();
  await db.insert(auditLogs).values({
    actorId: input.actor.id,
    actorUsernameSnapshot: input.actor.username,
    actorRoleSnapshot: input.actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {},
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: requestHeaders.get("user-agent"),
  });
}

export function sessionActor(session: {
  user: { id: string; username: string; role: AppRole | string };
}): AuditActor {
  return {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role,
  };
}
