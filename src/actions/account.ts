"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ActionState } from "@/actions/types";
import { actionError } from "@/actions/types";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { writeAuditLog, sessionActor } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validation";

export async function changeInitialPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession({ allowPasswordChange: true });
    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: "กรุณาตรวจสอบข้อมูล",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });
    await db
      .update(user)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));
    await writeAuditLog({
      actor: sessionActor(session),
      action: "PASSWORD_CHANGED",
      targetType: "user",
      targetId: session.user.id,
      metadata: { initialPasswordChanged: true },
    });
  } catch (error) {
    return actionError(error);
  }
  redirect("/dashboard");
}
