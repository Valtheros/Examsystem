"use client";

import {
  BookOpenCheck,
  Boxes,
  ChevronRight,
  ClipboardList,
  FileClock,
  History,
  MailWarning,
  House,
  LogOut,
  Menu,
  Printer,
  RotateCcw,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { ROLES, type AppRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-controls";
import { InstructorNotificationBell } from "@/components/instructor-notifications";

const allRoles = Object.values(ROLES);
const items = [
  { href: "/dashboard", label: "ภาพรวม", icon: House, roles: allRoles },
  { href: "/dashboard/users", label: "ผู้ใช้", icon: Users, roles: [ROLES.ADMIN] },
  { href: "/dashboard/rounds", label: "รอบสอบ", icon: Boxes, roles: [ROLES.OFFICER] },
  { href: "/dashboard/rooms", label: "ข้อมูลห้องสอบ", icon: Settings2, roles: [ROLES.OFFICER] },
  { href: "/dashboard/subjects", label: "จัดรายวิชาและตารางสอบ", icon: BookOpenCheck, roles: [ROLES.OFFICER] },
  { href: "/dashboard/requests", label: "คำขอข้อสอบ", icon: ClipboardList, roles: allRoles },
  { href: "/dashboard/review", label: "ตรวจคำขอ", icon: FileClock, roles: [ROLES.AV_UNIT] },
  { href: "/dashboard/printing", label: "งานพิมพ์", icon: Printer, roles: [ROLES.AV_UNIT] },
  { href: "/dashboard/audit", label: "Audit Log", icon: History, roles: [ROLES.ADMIN] },
  { href: "/dashboard/notifications", label: "การส่งอีเมล", icon: MailWarning, roles: [ROLES.ADMIN] },
  { href: "/dashboard/reset", label: "Factory Reset", icon: RotateCcw, roles: [ROLES.ADMIN] },
] as const;

function NavLinks({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="space-y-1.5">
      {items
        .filter((item) => (item.roles as readonly AppRole[]).includes(role))
        .map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Fragment key={item.href}>
              {item.href === "/dashboard/audit" ? <p className="mb-3 mt-7 border-t border-sidebar-border px-3 pt-5 text-xs font-medium text-sidebar-foreground/65">จัดการระบบ</p> : null}
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                  active
                    ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
                <span className="min-w-0 flex-1">{item.label}</span>
                {active ? <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-sidebar-primary" /> : null}
              </Link>
            </Fragment>
          );
        })}
    </nav>
  );
}

function AccountIdentity({ name, username, role }: { name: string; username: string; role: AppRole }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-sm font-semibold text-sidebar-foreground">{initials || username.slice(0, 2)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground" title={name}>{name}</p>
        <p className="mt-0.5 truncate text-xs text-sidebar-foreground/70" title={username}>{role} · {username}</p>
      </div>
    </div>
  );
}

export function DashboardNav({
  role,
  name,
  username,
}: {
  role: AppRole;
  name: string;
  username: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPage = items.find((item) => item.href !== "/dashboard" && pathname.startsWith(item.href)) ?? items[0];
  const pageTitle = pathname === "/dashboard/requests/new"
    ? "ส่งข้อสอบ"
    : pathname.startsWith("/dashboard/requests/")
      ? "รายละเอียดคำขอ"
      : currentPage.label;
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 bg-background px-4 py-3 text-primary focus:not-sr-only">ข้ามไปเนื้อหาหลัก</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-66 flex-col border-r border-sidebar-border bg-sidebar px-5 pb-5 pt-6 text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border pb-6"><Brand appearance="sidebar" /></div>
        <div className="min-h-0 flex-1 overflow-y-auto py-6">
          <NavLinks role={role} />
        </div>
        <div className="border-t border-sidebar-border pt-5">
          <AccountIdentity name={name} username={username} role={role} />
          <Button variant="ghost" className="mt-3 w-full justify-start text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-ring dark:hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut aria-hidden="true" className="size-4" /> ออกจากระบบ
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card px-4 text-card-foreground sm:px-6 lg:ml-66 lg:px-8">
        <div className="lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="เปิดเมนู">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-5 pt-14 text-sidebar-foreground data-[side=left]:w-72 [&_[data-slot=sheet-close]]:text-sidebar-foreground [&_[data-slot=sheet-close]]:hover:bg-sidebar-accent" aria-describedby={undefined}>
              <SheetTitle className="sr-only">เมนูระบบ</SheetTitle>
              <div className="border-b border-sidebar-border pb-5"><Brand appearance="sidebar" /></div>
              <div className="flex-1 py-5"><NavLinks role={role} onNavigate={() => setMenuOpen(false)} /></div>
              <div className="border-t border-sidebar-border pt-5"><AccountIdentity name={name} username={username} role={role} /></div>
            </SheetContent>
          </Sheet>
        </div>
        <nav aria-label="ตำแหน่งปัจจุบัน" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <Link href="/dashboard" className="hidden min-h-11 shrink-0 items-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:inline-flex">พื้นที่ทำงาน</Link>
          <ChevronRight aria-hidden="true" className="hidden size-3.5 shrink-0 text-muted-foreground/60 sm:block" />
          <span aria-current="page" className="truncate font-medium">{pageTitle}</span>
        </nav>
        <span className="mr-2 hidden border-r pr-5 text-sm text-muted-foreground lg:block">{role}</span>
        <InstructorNotificationBell />
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="ออกจากระบบ" title="ออกจากระบบ" onClick={signOut}>
          <LogOut aria-hidden="true" className="size-4" />
        </Button>
      </header>
    </>
  );
}
