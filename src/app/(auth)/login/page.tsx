import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <LoginForm nextPath={safeNext} />
    </main>
  );
}
