import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-controls";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(session.user.mustChangePassword ? "/change-password" : "/dashboard");
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between border-b py-6"><Brand /><ThemeToggle /></header>
      <div className="flex flex-1 justify-center py-14 sm:py-20"><LoginForm nextPath={safeNext} /></div>
    </main>
  );
}
