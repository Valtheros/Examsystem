"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import type { ActionState } from "@/actions/types";
import { actionError } from "@/actions/types";
import { db } from "@/db";
import { auditLogs, user } from "@/db/schema";
import { writeAuditLog, sessionActor } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { AuthorizationError } from "@/lib/errors";
import { queueAndTrySendEmail } from "@/lib/mail";
import { requireRole } from "@/lib/session";
import {
  createUserSchema,
  passwordSchema,
  updateUserSchema,
} from "@/lib/validation";

export async function createUserAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.ADMIN]);
    const parsed = createUserSchema.safeParse({
      username: formData.get("username"),
      email: formData.get("email"),
      name: formData.get("name"),
      role: formData.get("role"),
      initialPassword: formData.get("initialPassword"),
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: "กรุณาตรวจสอบข้อมูลผู้ใช้",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const created = await auth.api.createUser({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        password: parsed.data.initialPassword,
        name: parsed.data.name,
        role: parsed.data.role,
        data: {
          username: parsed.data.username,
          displayUsername: parsed.data.username,
          createdBy: session.user.id,
          mustChangePassword: true,
        },
      },
    });

    await writeAuditLog({
      actor: sessionActor(session),
      action: "USER_CREATED",
      targetType: "user",
      targetId: created.user.id,
      metadata: {
        username: parsed.data.username,
        role: parsed.data.role,
      },
    });

    await queueAndTrySendEmail({
      userId: created.user.id,
      type: "สร้างบัญชี",
      emailTo: parsed.data.email,
      subject: "บัญชีระบบจัดพิมพ์ข้อสอบถูกสร้างแล้ว",
      message: `เรียน ${parsed.data.name}\n\nผู้ดูแลระบบได้สร้างบัญชี Username: ${parsed.data.username} ให้คุณแล้ว กรุณารับรหัสผ่านเริ่มต้นจากผู้ดูแลผ่านช่องทางที่ตกลงกัน และเปลี่ยนรหัสผ่านทันทีเมื่อเข้าสู่ระบบครั้งแรก`,
    });

    revalidatePath("/dashboard/users");
    return { ok: true, message: "สร้างบัญชีแล้ว (ระบบไม่ส่งรหัสผ่านทางอีเมล)" };
  } catch (error) {
    return actionError(error);
  }
}

export async function setUserActiveAction(formData: FormData) {
  const session = await requireRole([ROLES.ADMIN]);
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!userId) throw new Error("ไม่พบรหัสผู้ใช้");
  if (userId === session.user.id && !active) {
    throw new AuthorizationError("ไม่สามารถปิดบัญชีที่กำลังใช้งานอยู่");
  }

  if (active) {
    await auth.api.unbanUser({
      headers: await headers(),
      body: { userId },
    });
  } else {
    await auth.api.banUser({
      headers: await headers(),
      body: { userId, banReason: "ปิดใช้งานโดยผู้ดูแลระบบ" },
    });
    await auth.api.revokeUserSessions({
      headers: await headers(),
      body: { userId },
    });
  }

  await writeAuditLog({
    actor: sessionActor(session),
    action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    targetType: "user",
    targetId: userId,
  });
  revalidatePath("/dashboard/users");
}

export async function updateUserAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.ADMIN]);
    const parsed = updateUserSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        message: "กรุณาตรวจสอบข้อมูลผู้ใช้",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const changedRole = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      const [current] = await tx
        .select()
        .from(user)
        .where(eq(user.id, parsed.data.userId))
        .for("update")
        .limit(1);
      if (!current) throw new Error("ไม่พบบัญชีผู้ใช้");
      if (
        current.id === session.user.id &&
        parsed.data.role !== ROLES.ADMIN
      ) {
        throw new AuthorizationError(
          "ไม่สามารถเปลี่ยนบทบาทบัญชีผู้ดูแลที่กำลังใช้งานอยู่",
        );
      }

      await tx
        .update(user)
        .set({
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          role: parsed.data.role,
          updatedAt: new Date(),
        })
        .where(eq(user.id, current.id));
      await tx.insert(auditLogs).values({
        actorId: session.user.id,
        actorUsernameSnapshot: session.user.username,
        actorRoleSnapshot: session.user.role,
        action: "USER_UPDATED",
        targetType: "user",
        targetId: current.id,
        metadata: {
          username: current.username,
          previousRole: current.role,
          role: parsed.data.role,
        },
      });
      return current.role !== parsed.data.role;
    });

    if (changedRole && parsed.data.userId !== session.user.id) {
      await auth.api.revokeUserSessions({
        headers: await headers(),
        body: { userId: parsed.data.userId },
      });
    }
    revalidatePath("/dashboard/users");
    return { ok: true, message: "แก้ไขข้อมูลผู้ใช้แล้ว" };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetUserPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireRole([ROLES.ADMIN]);
    const userId = String(formData.get("userId") ?? "");
    const parsed = passwordSchema.safeParse(formData.get("temporaryPassword"));
    if (!userId || !parsed.success) {
      return {
        ok: false,
        message: parsed.success ? "ไม่พบผู้ใช้" : parsed.error.issues[0]?.message ?? "รหัสผ่านไม่ถูกต้อง",
      };
    }

    await auth.api.setUserPassword({
      headers: await headers(),
      body: { userId, newPassword: parsed.data },
    });
    await auth.api.revokeUserSessions({
      headers: await headers(),
      body: { userId },
    });
    await db
      .update(user)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(eq(user.id, userId));
    await writeAuditLog({
      actor: sessionActor(session),
      action: "USER_PASSWORD_RESET",
      targetType: "user",
      targetId: userId,
    });
    revalidatePath("/dashboard/users");
    return { ok: true, message: "เปลี่ยนรหัสผ่านแล้ว ผู้ใช้ต้องตั้งรหัสส่วนตัวใหม่เมื่อเข้าสู่ระบบ" };
  } catch (error) {
    return actionError(error);
  }
}
