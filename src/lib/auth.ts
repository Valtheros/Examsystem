import "server-only";

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { account, auditLogs, session, user, verification } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { sendPasswordResetEmail } from "@/lib/mail";

const thaiRoles = {
  "ผู้ดูแลระบบ": adminAc,
  "เจ้าหน้าที่": userAc,
  "อาจารย์": userAc,
  "หน่วยโสต": userAc,
} as const;

export const auth = betterAuth({
  appName: "ระบบจัดพิมพ์ข้อสอบ คณะวิทยาศาสตร์",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
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
        after: async (createdSession, context) => {
          try {
            const [actor] = await db
              .select({ username: user.username, role: user.role })
              .from(user)
              .where(eq(user.id, createdSession.userId))
              .limit(1);
            if (!actor) return;
            const requestHeaders = context?.headers as Headers | undefined;
            await db.insert(auditLogs).values({
              actorId: createdSession.userId,
              actorUsernameSnapshot: actor.username,
              actorRoleSnapshot: actor.role,
              action: "USER_SIGNED_IN",
              targetType: "session",
              targetId: createdSession.id,
              metadata: {},
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
      roles: thaiRoles,
      defaultRole: ROLES.INSTRUCTOR,
      adminRoles: [ROLES.ADMIN],
      bannedUserMessage: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
