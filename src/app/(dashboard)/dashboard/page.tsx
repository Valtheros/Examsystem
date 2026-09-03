import { and, count, eq, isNull } from "drizzle-orm";
import { ClipboardCheck, FileClock, Printer, Users } from "lucide-react";

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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-primary">ภาพรวมระบบ</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">สวัสดี {session.user.name}</h1>
        <p className="mt-2 text-muted-foreground">ข้อมูลที่แสดงถูกกรองตามสิทธิ์ของบทบาท {session.user.role}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      <Card>
        <CardHeader><CardTitle>ขั้นตอนหลัก</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {["ฉบับร่าง", "รอตรวจสอบ", "ตัดข้อสอบ", "กำลังพิมพ์", "พิมพ์เสร็จแล้ว", "ส่งมอบแล้ว"].map((status, index) => (
            <div key={status} className="rounded-xl border bg-muted/35 p-4">
              <p className="text-xs text-muted-foreground">ขั้นที่ {index + 1}</p>
              <p className="mt-1 font-medium">{status}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
