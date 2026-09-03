import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAppRole, type AppRole } from "@/lib/constants";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

export type AppSession = Awaited<ReturnType<typeof auth.api.getSession>> & {
  user: {
    id: string;
    username: string;
    role: AppRole;
    mustChangePassword: boolean;
    banned?: boolean | null;
  };
};

export async function getSession(): Promise<AppSession | null> {
  const value = await auth.api.getSession({ headers: await headers() });
  if (!value || !isAppRole(value.user.role)) return null;
  return value as AppSession;
}

export async function requireSession(options?: {
  allowPasswordChange?: boolean;
}): Promise<AppSession> {
  const value = await getSession();
  if (!value) throw new AuthenticationError();
  if (value.user.banned) throw new AuthorizationError("บัญชีนี้ถูกปิดใช้งาน");
  if (value.user.mustChangePassword && !options?.allowPasswordChange) {
    throw new AuthorizationError("กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งานระบบ");
  }
  return value;
}

export async function requirePageSession() {
  const value = await getSession();
  if (!value) redirect("/login");
  if (value.user.mustChangePassword) redirect("/change-password");
  return value;
}

export async function requireRole(allowed: readonly AppRole[]) {
  const value = await requireSession();
  if (!allowed.includes(value.user.role)) throw new AuthorizationError();
  return value;
}

export async function requirePageRole(allowed: readonly AppRole[]) {
  const value = await requirePageSession();
  if (!allowed.includes(value.user.role)) redirect("/dashboard");
  return value;
}
