import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/change-password-form";
import { getSession } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "เปลี่ยนรหัสผ่านเริ่มต้น" };

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/dashboard");
  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-sm sm:p-10"><ChangePasswordForm /></div>
    </AuthShell>
  );
}
