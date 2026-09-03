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
  ScanLine,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { ROLES, type AppRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

const allRoles = Object.values(ROLES);
const items = [
  { href: "/dashboard", label: "ภาพรวม", icon: House, roles: allRoles },
  { href: "/dashboard/users", label: "ผู้ใช้", icon: Users, roles: [ROLES.ADMIN] },
  { href: "/dashboard/audit", label: "Audit Log", icon: History, roles: [ROLES.ADMIN] },
  { href: "/dashboard/notifications", label: "การส่งอีเมล", icon: MailWarning, roles: [ROLES.ADMIN] },
  { href: "/dashboard/reset", label: "Factory Reset", icon: RotateCcw, roles: [ROLES.ADMIN] },
  { href: "/dashboard/rounds", label: "รอบสอบ", icon: Boxes, roles: [ROLES.OFFICER] },
  { href: "/dashboard/rooms", label: "ห้องสอบ", icon: Settings2, roles: [ROLES.OFFICER] },
  { href: "/dashboard/subjects", label: "รายวิชาและตาราง", icon: BookOpenCheck, roles: [ROLES.OFFICER] },
  { href: "/dashboard/requests", label: "คำขอข้อสอบ", icon: ClipboardList, roles: allRoles },
  { href: "/dashboard/review", label: "ตรวจคำขอ", icon: FileClock, roles: [ROLES.AV_UNIT] },
  { href: "/dashboard/printing", label: "งานพิมพ์", icon: Printer, roles: [ROLES.AV_UNIT] },
  { href: "/dashboard/deliveries", label: "รับมอบ/แจกจ่าย", icon: ScanLine, roles: [ROLES.OFFICER, ROLES.AV_UNIT] },
] as const;

function NavLinks({ role }: { role: AppRole }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items
        .filter((item) => (item.roles as readonly AppRole[]).includes(role))
        .map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Printer className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">ระบบจัดพิมพ์ข้อสอบ</p>
        <p className="text-xs text-muted-foreground">คณะวิทยาศาสตร์</p>
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
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar/95 p-4 backdrop-blur lg:flex lg:flex-col">
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

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:ml-64 lg:px-8">
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="เปิดเมนู">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetTitle className="sr-only">เมนูระบบ</SheetTitle>
              <Brand />
              <div className="mt-8"><NavLinks role={role} /></div>
            </SheetContent>
          </Sheet>
        </div>
        <p className="hidden text-sm text-muted-foreground sm:block lg:ml-auto">
          เข้าสู่ระบบเป็น <span className="font-medium text-foreground">{role}</span>
        </p>
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={signOut}>
          <LogOut className="size-4" /> ออกจากระบบ
        </Button>
      </header>
    </>
  );
}
