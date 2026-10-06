import { and, count, eq, isNull } from "drizzle-orm";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, DoorOpen, FilePlus2, Files, Mail, Printer, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { examRequests, examRounds, user } from "@/db/schema";
import { REQUEST_STATUSES, ROLE_LABELS, ROLES } from "@/lib/constants";
import { requirePageSession } from "@/lib/session";
import { cn } from "@/lib/utils";

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
    ? [
      { href: "users", title: "จัดการบัญชีผู้ใช้", detail: "สร้างบัญชี กำหนดบทบาท และเปิด-ปิดการใช้งาน", icon: UsersRound },
      { href: "notifications", title: "ตรวจสอบการส่งอีเมล", detail: "ตรวจรายการส่งไม่สำเร็จและลองส่งใหม่", icon: Mail },
      { href: "reset", title: "ล้างข้อมูลงานสอบ", detail: "ล้างงานสอบและไฟล์ โดยเก็บบัญชีผู้ใช้ทุกคนไว้", icon: Trash2 },
    ]
    : session.user.role === ROLES.OFFICER
      ? [
        { href: "rounds", title: "1. เตรียมรอบสอบ", detail: "เลือกกลางภาค ปลายภาค หรือระบุรอบสอบอื่น", icon: CalendarDays },
        { href: "rooms", title: "2. เตรียมข้อมูลห้องสอบ", detail: "กำหนดห้อง อาคาร และความจุ", icon: DoorOpen },
        { href: "subjects", title: "3. จัดรายวิชาและตารางสอบ", detail: "เลือกอาจารย์ วัน เวลา และห้องที่มีความจุเพียงพอ", icon: BookOpen },
        { href: "requests", title: "ติดตามการจัดพิมพ์", detail: "ดูสถานะคำขอจนหน่วยโสตพิมพ์เสร็จ", icon: Files },
      ]
      : session.user.role === ROLES.INSTRUCTOR
        ? [
          { href: "requests/new", title: "ส่งข้อสอบ", detail: "เลือกรายวิชา กรอกแบบฟอร์มและแนบ PDF แล้วตรวจทานก่อนส่ง", icon: FilePlus2 },
          { href: "requests", title: "ติดตามคำขอของคุณ", detail: "ดูสถานะ กลับมาแก้ไขฉบับร่าง หรือแก้คำขอที่ส่งกลับ", icon: Files },
        ]
        : [
          { href: "review", title: "1. ตรวจคำขอ", detail: "ตรวจไฟล์และรายละเอียด รับงาน หรือส่งกลับแก้ไขพร้อมเหตุผล", icon: ClipboardCheck },
          { href: "printing", title: "2. ดำเนินการพิมพ์", detail: "เตรียมใบปะหน้าซอง พิมพ์และจัดซอง แล้วยืนยันพิมพ์เสร็จเพื่อจบงาน", icon: Printer },
        ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 sm:space-y-10">
      <header className="rounded-xl border-l-4 border-primary bg-feature px-5 py-6 text-feature-foreground sm:px-7 sm:py-8">
        <p className="text-sm font-medium">พื้นที่ทำงานของ{session.user.role}</p>
        <h1 className="mt-2 break-words text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">สวัสดี {session.user.name}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">{ROLE_LABELS[session.user.role]}</p>
      </header>
      <section aria-labelledby="your-tasks">
        <h2 id="your-tasks" className="mb-4 text-xl font-semibold">งานของคุณ</h2>
        <ul className="divide-y border-b">
          {shortcuts.map((item, index) => (
            <li key={item.href}>
              <Link
                href={`/dashboard/${item.href}`}
                className={cn(
                  "group flex items-center gap-3 px-3 py-5 transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:gap-4 sm:px-5 sm:py-6",
                  index === 0 && "rounded-t-lg bg-feature/65",
                )}
              >
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-11", index === 0 ? "bg-primary text-primary-foreground" : "text-primary")}>
                  <item.icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={cn("font-semibold leading-relaxed group-hover:text-primary", index === 0 && "text-primary")}>{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                </div>
                <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-primary motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="system-summary">
        <h2 id="system-summary" className="mb-4 text-sm font-medium text-muted-foreground">สถิติและภาพรวมระบบ</h2>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-6 rounded-lg bg-muted/70 px-5 py-6 sm:grid-cols-4 sm:px-6">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt className="text-sm text-muted-foreground">{metric.label}</dt>
              <dd className="metric-number mt-2 text-3xl font-semibold text-foreground">{metric.value.toLocaleString("th-TH")}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
