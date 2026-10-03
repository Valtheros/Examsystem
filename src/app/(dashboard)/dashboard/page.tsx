import { and, count, eq, isNull } from "drizzle-orm";
import { ClipboardCheck, FileClock, Printer, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { examRequests, examRounds, user } from "@/db/schema";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { requirePageSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requirePageSession();
  const ownerCondition =
    session.user.role === ROLES.INSTRUCTOR
      ? eq(examRequests.instructorId, session.user.id)
      : undefined;
  const [[requestTotal], [waiting], [printing], [roundTotal], [userTotal]] = await Promise.all([
    db.select({ value: count() }).from(examRequests).where(and(isNull(examRequests.cancelledAt), ownerCondition)),
    db.select({ value: count() }).from(examRequests).where(and(isNull(examRequests.cancelledAt), eq(examRequests.status, REQUEST_STATUSES.PENDING_REVIEW), ownerCondition)),
    db.select({ value: count() }).from(examRequests).where(and(isNull(examRequests.cancelledAt), eq(examRequests.status, REQUEST_STATUSES.PRINTING), ownerCondition)),
    db.select({ value: count() }).from(examRounds).where(eq(examRounds.isActive, true)),
    db.select({ value: count() }).from(user).where(eq(user.banned, false)),
  ]);

  const metrics = [
    { label: "คำขอในระบบ", value: requestTotal?.value ?? 0, icon: ClipboardCheck },
    { label: "รอตรวจสอบ", value: waiting?.value ?? 0, icon: FileClock },
    { label: "กำลังพิมพ์", value: printing?.value ?? 0, icon: Printer },
    session.user.role === ROLES.ADMIN
      ? { label: "บัญชีที่เปิดใช้งาน", value: userTotal?.value ?? 0, icon: Users }
      : { label: "รอบสอบที่เปิดอยู่", value: roundTotal?.value ?? 0, icon: Users },
  ];
  const shortcuts = session.user.role === ROLES.ADMIN
    ? [{ href: "users", title: "จัดการบัญชีผู้ใช้", detail: "สร้างบัญชี กำหนดบทบาท และเปิด–ปิดการใช้งาน" }, { href: "notifications", title: "ตรวจสอบการส่งอีเมล", detail: "ตรวจรายการส่งไม่สำเร็จและลองส่งใหม่" }]
    : session.user.role === ROLES.OFFICER
      ? [{ href: "rounds", title: "1. เตรียมรอบสอบ", detail: "เลือกกลางภาค ปลายภาค หรือระบุรอบสอบอื่น" }, { href: "rooms", title: "2. เตรียมข้อมูลห้องสอบ", detail: "กำหนดห้อง อาคาร และความจุ" }, { href: "subjects", title: "3. จัดรายวิชาและตารางสอบ", detail: "เลือกอาจารย์ วัน เวลา และห้องที่มีความจุเพียงพอ" }, { href: "requests", title: "ติดตามการจัดพิมพ์", detail: "ดูสถานะคำขอจนหน่วยโสตพิมพ์เสร็จ" }]
      : session.user.role === ROLES.INSTRUCTOR
        ? [{ href: "requests", title: "สร้างและติดตามคำขอ", detail: "เลือกรายวิชาของคุณ แนบไฟล์ข้อสอบ และส่งให้หน่วยโสตตรวจสอบ" }]
        : [{ href: "review", title: "1. ตรวจคำขอ", detail: "ตรวจไฟล์และรายละเอียด รับงาน หรือส่งกลับแก้ไขพร้อมเหตุผล" }, { href: "printing", title: "2. ดำเนินการพิมพ์", detail: "เตรียมใบปะหน้าซอง พิมพ์และจัดซอง แล้วยืนยันพิมพ์เสร็จเพื่อจบงาน" }];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-sm font-medium text-primary">ภาพรวมระบบ</p>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">สวัสดี {session.user.name}</h1>
        <p className="mt-2 text-muted-foreground">ข้อมูลที่แสดงถูกกรองตามสิทธิ์ของบทบาท {session.user.role}</p>
        <div className="mt-4"><Button asChild><Link href={session.user.role === ROLES.ADMIN ? "/dashboard/users" : session.user.role === ROLES.INSTRUCTOR ? "/dashboard/requests/new" : session.user.role === ROLES.OFFICER ? "/dashboard/subjects" : "/dashboard/review"}>{session.user.role === ROLES.ADMIN ? "สร้างบัญชี / จัดการผู้ใช้" : session.user.role === ROLES.INSTRUCTOR ? "ส่งข้อสอบ" : session.user.role === ROLES.OFFICER ? "จัดตารางสอบ" : "ตรวจข้อสอบที่รอรับงาน"}</Link></Button></div>
      </div>
      <section aria-label="งานของคุณ" className="flex flex-col gap-3">
        {shortcuts.map((item) => <Link key={item.href} href={`/dashboard/${item.href}`} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><h2 className="font-semibold text-primary">{item.title} →</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p></Link>)}
      </section>
      <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-medium">สถิติและภาพรวมระบบ</summary><div className="mt-4">      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
                <Icon className="size-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="metric-number text-4xl font-semibold">{metric.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
</div></details>

      <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-medium">ขั้นตอนทั้งหมดของระบบ</summary><Card className="mt-4 border-0 shadow-none">
        <CardHeader><CardTitle>ขั้นตอนหลัก</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {["ฉบับร่าง", "รอตรวจสอบ", "ตัดข้อสอบ", "กำลังพิมพ์", "พิมพ์เสร็จแล้ว"].map((status, index) => (
            <div key={status} className="rounded-xl border bg-muted/35 p-4">
              <p className="text-xs text-muted-foreground">ขั้นที่ {index + 1}</p>
              <p className="mt-1 font-medium">{status}</p>
            </div>
          ))}
        </CardContent>
      </Card></details>
    </div>
  );
}
