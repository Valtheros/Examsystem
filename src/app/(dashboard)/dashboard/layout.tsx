import { DashboardNav } from "@/components/dashboard-nav";
import { requirePageSession } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession();
  return (
    <div className="min-h-screen">
      <DashboardNav
        role={session.user.role}
        name={session.user.name}
        username={session.user.username}
      />
      <main className="px-4 py-7 sm:px-6 lg:ml-64 lg:px-8 lg:py-9">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
import type { ReactNode } from "react";
