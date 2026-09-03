import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/change-password-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "เปลี่ยนรหัสผ่านเริ่มต้น" };

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/dashboard");
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <ChangePasswordForm />
    </main>
  );
}
