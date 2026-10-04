"use client";

import {
  BookOpenCheck,
  Boxes,
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
    <nav aria-label="เมนูหลัก" className="space-y-1">
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
            {item.href === "/dashboard/audit" ? <p className="mb-2 mt-6 border-t px-3 pt-4 text-xs font-semibold text-muted-foreground">จัดการระบบ</p> : null}
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "border-primary bg-accent text-primary"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
            </Fragment>
          );
        })}
    </nav>
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
  const [menuOpen, setMenuOpen] = useState(false);
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 bg-background px-4 py-3 text-primary focus:not-sr-only">ข้ามไปเนื้อหาหลัก</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar p-5 lg:flex lg:flex-col">
        <Brand />
        <div className="mt-8 flex-1 overflow-y-auto">
          <NavLinks role={role} />
        </div>
        <div className="border-t pt-4">
          <p className="truncate px-2 text-sm font-medium">{name}</p>
          <p className="truncate px-2 text-xs text-muted-foreground">{username} · {role}</p>
          <Button variant="ghost" className="mt-2 w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> ออกจากระบบ
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background px-4 lg:ml-64 lg:px-8">
        <div className="lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="เปิดเมนู">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto p-4 pt-12" aria-describedby={undefined}>
              <SheetTitle className="sr-only">เมนูระบบ</SheetTitle>
              <Brand />
              <div className="mt-4 border-b pb-4"><p className="break-words text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">{role}</p></div>
              <div className="mt-4"><NavLinks role={role} onNavigate={() => setMenuOpen(false)} /></div>
            </SheetContent>
          </Sheet>
        </div>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{role}</span>
        </p>
        <ThemeToggle />
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={signOut}>
          <LogOut className="size-4" /> ออกจากระบบ
        </Button>
      </header>
    </>
  );
}
