import { DashboardNav } from "@/components/dashboard-nav";
import { requirePageSession } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { getInstructorNotifications } from "@/lib/notifications";
import { InstructorNotificationsProvider } from "@/components/instructor-notifications";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession();
  const content = (
    <div className="min-h-dvh bg-background">
      <DashboardNav
        role={session.user.role}
        name={session.user.name}
        username={session.user.username}
      />
      <main id="main-content" tabIndex={-1} className="px-3 py-5 outline-none sm:px-6 sm:py-7 lg:ml-66 lg:px-8 lg:py-8">
        <div className="mx-auto min-w-0 max-w-5xl rounded-xl border bg-card p-5 text-card-foreground shadow-xs sm:p-8 lg:p-9">{children}</div>
      </main>
    </div>
  );
  if (session.user.role !== ROLES.INSTRUCTOR) return content;
  return <InstructorNotificationsProvider key={session.user.id} userId={session.user.id} initialNotifications={await getInstructorNotifications(session.user.id)}>{content}</InstructorNotificationsProvider>;
}
import type { ReactNode } from "react";
