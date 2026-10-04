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
      <main id="main-content" tabIndex={-1} className="px-5 py-8 outline-none sm:px-8 lg:ml-64 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
import type { ReactNode } from "react";
