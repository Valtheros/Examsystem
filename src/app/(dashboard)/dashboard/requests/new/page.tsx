import { and, eq } from "drizzle-orm";

import { CreateRequestForm } from "@/components/request-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { examRounds, subjects } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function NewRequestPage() {
  const session = await requirePageRole([ROLES.INSTRUCTOR]);
  const rows = await db.select({ subject: subjects, round: examRounds }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).where(and(eq(subjects.instructorId, session.user.id), eq(examRounds.isActive, true)));
  const options = rows.map(({ subject, round }) => ({ id: subject.id, label: `${subject.courseCode} ${subject.courseName} · กลุ่ม ${subject.groupNo} · ${round.name}` }));
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div><p className="text-sm font-medium text-primary">อาจารย์</p><h1 className="text-3xl font-semibold">สร้างคำขอส่งข้อสอบ</h1><p className="mt-2 text-muted-foreground">แบบฟอร์มหลัก 3 ขั้นตอน จากนั้นอัปโหลดไฟล์และกดส่งตรวจ รวมไม่เกิน 5 ขั้นตอน</p></div>
      <Card><CardHeader><CardTitle>ข้อมูลคำขอ</CardTitle><CardDescription>จำนวนพิมพ์ไม่กำหนดตายตัว ระบบคำนวณจากผู้เข้าสอบแต่ละห้อง + สำรอง 1 ชุด</CardDescription></CardHeader><CardContent>{options.length ? <CreateRequestForm subjects={options} /> : <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">ยังไม่มีรายวิชาในรอบสอบที่เปิดอยู่ กรุณาติดต่อเจ้าหน้าที่</p>}</CardContent></Card>
    </div>
  );
}
