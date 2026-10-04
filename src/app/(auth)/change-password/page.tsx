import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/change-password-form";
import { getSession } from "@/lib/session";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-controls";

export const metadata: Metadata = { title: "เปลี่ยนรหัสผ่านเริ่มต้น" };

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between border-b py-6"><Brand /><ThemeToggle /></header>
      <div className="flex justify-center py-10 sm:py-16"><ChangePasswordForm /></div>
    </main>
  );
}
