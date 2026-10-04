import { and, count, eq, isNull } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
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
    { label: "คำขอในระบบ", value: requestTotal?.value ?? 0 },
    { label: "รอตรวจสอบ", value: waiting?.value ?? 0 },
    { label: "กำลังพิมพ์", value: printing?.value ?? 0 },
    session.user.role === ROLES.ADMIN
      ? { label: "บัญชีที่เปิดใช้งาน", value: userTotal?.value ?? 0 }
      : { label: "รอบสอบที่เปิดอยู่", value: roundTotal?.value ?? 0 },
  ];
  const shortcuts = session.user.role === ROLES.ADMIN
    ? [{ href: "users", title: "จัดการบัญชีผู้ใช้", detail: "สร้างบัญชี กำหนดบทบาท และเปิด-ปิดการใช้งาน" }, { href: "notifications", title: "ตรวจสอบการส่งอีเมล", detail: "ตรวจรายการส่งไม่สำเร็จและลองส่งใหม่" }]
    : session.user.role === ROLES.OFFICER
      ? [{ href: "rounds", title: "1. เตรียมรอบสอบ", detail: "เลือกกลางภาค ปลายภาค หรือระบุรอบสอบอื่น" }, { href: "rooms", title: "2. เตรียมข้อมูลห้องสอบ", detail: "กำหนดห้อง อาคาร และความจุ" }, { href: "subjects", title: "3. จัดรายวิชาและตารางสอบ", detail: "เลือกอาจารย์ วัน เวลา และห้องที่มีความจุเพียงพอ" }, { href: "requests", title: "ติดตามการจัดพิมพ์", detail: "ดูสถานะคำขอจนหน่วยโสตพิมพ์เสร็จ" }]
      : session.user.role === ROLES.INSTRUCTOR
        ? [{ href: "requests", title: "สร้างและติดตามคำขอ", detail: "เลือกรายวิชาของคุณ แนบไฟล์ข้อสอบ และส่งให้หน่วยโสตตรวจสอบ" }]
        : [{ href: "review", title: "1. ตรวจคำขอ", detail: "ตรวจไฟล์และรายละเอียด รับงาน หรือส่งกลับแก้ไขพร้อมเหตุผล" }, { href: "printing", title: "2. ดำเนินการพิมพ์", detail: "เตรียมใบปะหน้าซอง พิมพ์และจัดซอง แล้วยืนยันพิมพ์เสร็จเพื่อจบงาน" }];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <p className="text-sm font-medium text-primary">ภาพรวมระบบ</p>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">สวัสดี {session.user.name}</h1>
        <p className="mt-2 text-muted-foreground">เลือกงานที่ต้องการทำด้านล่าง ข้อมูลแสดงตามสิทธิ์ของคุณ</p>
      </div>
      <section aria-labelledby="your-tasks">
        <h2 id="your-tasks" className="mb-4 text-lg font-semibold">งานของคุณ</h2>
        <ul className="divide-y border-y">
          {session.user.role === ROLES.INSTRUCTOR ? <li><Link href="/dashboard/requests/new" className="group flex items-center justify-between gap-4 py-6 pr-2 focus-visible:outline-2 focus-visible:outline-ring hover:bg-muted"><div><h3 className="font-semibold text-primary">ส่งข้อสอบ</h3><p className="mt-1 text-sm text-muted-foreground">เลือกรายวิชา กรอกแบบฟอร์มและแนบ PDF แล้วตรวจทานก่อนส่ง</p></div><ArrowRight aria-hidden="true" className="size-5 shrink-0 text-primary" /></Link></li> : null}
          {shortcuts.map((item) => <li key={item.href}><Link href={`/dashboard/${item.href}`} className="group flex items-center justify-between gap-4 py-6 pr-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><div><h3 className="font-semibold group-hover:text-primary">{item.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p></div><ArrowRight aria-hidden="true" className="size-5 shrink-0 text-primary" /></Link></li>)}
        </ul>
      </section>
      <section aria-labelledby="system-summary"><h2 id="system-summary" className="text-sm font-medium text-muted-foreground">สถิติและภาพรวมระบบ</h2><dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">{metrics.map((metric) => <div key={metric.label}><dt className="text-sm text-muted-foreground">{metric.label}</dt><dd className="metric-number mt-1 text-3xl font-medium">{metric.value}</dd></div>)}</dl></section>
      <details className="border-t"><summary className="text-sm font-medium">ขั้นตอนทั้งหมดของระบบ</summary><ol className="space-y-3 py-4 text-sm text-muted-foreground">{["ฉบับร่าง", "รอตรวจสอบ", "ตัดข้อสอบ", "กำลังพิมพ์", "พิมพ์เสร็จแล้ว"].map((status, index) => <li key={status}><span className="mr-3 tabular-nums">{index + 1}.</span>{status}</li>)}</ol></details>
    </div>
  );
}
