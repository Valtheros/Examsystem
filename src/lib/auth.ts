import "server-only";

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin, username } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { account, auditLogs, session, user, verification } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { impersonationBlockReason } from "@/lib/impersonation-policy";
import { sendPasswordResetEmail } from "@/lib/mail";

const thaiRoles = {
  "ผู้ดูแลระบบ": adminAc,
  "เจ้าหน้าที่": userAc,
  "อาจารย์": userAc,
  "หน่วยโสต": userAc,
} as const;

const authBaseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const configuredOrigin = new URL(authBaseURL);
const trustedOrigins = [configuredOrigin.origin];
// Local Docker is reachable through either loopback name; keep the same port/protocol.
if (["localhost", "127.0.0.1"].includes(configuredOrigin.hostname)) {
  const loopbackAlias = new URL(configuredOrigin);
  loopbackAlias.hostname = configuredOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
  trustedOrigins.push(loopbackAlias.origin);
}

export const auth = betterAuth({
  appName: "ระบบจัดพิมพ์ข้อสอบ คณะวิทยาศาสตร์",
  baseURL: authBaseURL,
  trustedOrigins,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "local-development-secret-change-before-production-123456",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user: targetUser, url }) => {
      await sendPasswordResetEmail({
        userId: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        resetUrl: url,
      });
    },
  },
  user: {
    additionalFields: {
      createdBy: {
        type: "string",
        required: false,
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (value) => {
          const impersonatorId = (value as typeof value & { impersonatedBy?: string }).impersonatedBy;
          if (!impersonatorId) return;
          const [target] = await db.select().from(user).where(eq(user.id, value.userId)).limit(1);
          const [actor] = await db.select().from(user).where(eq(user.id, impersonatorId)).limit(1);
          if (!actor || actor.role !== ROLES.ADMIN || actor.banned || actor.mustChangePassword) throw new APIError("FORBIDDEN", { message: "ต้องเป็นผู้ดูแลระบบที่เปิดใช้งานและเปลี่ยนรหัสผ่านแล้ว" });
          const reason = target ? impersonationBlockReason(target) : "ไม่พบบัญชีผู้ใช้";
          if (reason) throw new APIError("FORBIDDEN", { message: reason });
        },
        after: async (createdSession, context) => {
          try {
            const impersonatorId = (createdSession as typeof createdSession & { impersonatedBy?: string }).impersonatedBy;
            const [actor] = await db
              .select({ username: user.username, role: user.role })
              .from(user)
              .where(eq(user.id, impersonatorId ?? createdSession.userId))
              .limit(1);
            if (!actor) return;
            const requestHeaders = context?.headers as Headers | undefined;
            await db.insert(auditLogs).values({
              actorId: impersonatorId ?? createdSession.userId,
              actorUsernameSnapshot: actor.username,
              actorRoleSnapshot: actor.role,
              action: (createdSession as typeof createdSession & { impersonatedBy?: string }).impersonatedBy ? "IMPERSONATION_STARTED" : "USER_SIGNED_IN",
              targetType: "session",
              targetId: createdSession.id,
              metadata: { impersonatedBy: impersonatorId ?? null, effectiveUserId: createdSession.userId },
              ipAddress:
                requestHeaders?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                createdSession.ipAddress ??
                null,
              userAgent:
                requestHeaders?.get("user-agent") ??
                createdSession.userAgent ??
                null,
            });
          } catch (error) {
            console.error("Could not write sign-in audit log", error);
          }
        },
      },
      delete: {
        after: async (deletedSession) => {
          const impersonatorId = (deletedSession as typeof deletedSession & { impersonatedBy?: string }).impersonatedBy;
          if (!impersonatorId) return;
          const [actor] = await db.select().from(user).where(eq(user.id, impersonatorId)).limit(1);
          await db.insert(auditLogs).values({ actorId: actor?.id ?? null, actorUsernameSnapshot: actor?.username ?? impersonatorId, actorRoleSnapshot: actor?.role ?? ROLES.ADMIN, action: "IMPERSONATION_ENDED", targetType: "user", targetId: deletedSession.userId, metadata: { sessionId: deletedSession.id } });
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 50,
      immutableUsername: true,
    }),
    admin({
      impersonationSessionDuration: 3600,
      roles: thaiRoles,
      defaultRole: ROLES.INSTRUCTOR,
      adminRoles: [ROLES.ADMIN],
      bannedUserMessage: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
