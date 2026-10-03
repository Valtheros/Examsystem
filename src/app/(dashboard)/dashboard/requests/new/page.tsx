import { and, eq } from "drizzle-orm";

import { RequestEditor } from "@/components/request-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { examRounds, examRooms, rooms, subjects } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function NewRequestPage() {
  const session = await requirePageRole([ROLES.INSTRUCTOR]);
  const rows = await db.select({ subject: subjects, round: examRounds }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).where(and(eq(subjects.instructorId, session.user.id), eq(examRounds.isActive, true)));
  const schedules = await db.select({ schedule: examRooms, room: rooms }).from(examRooms).innerJoin(rooms, eq(examRooms.roomId, rooms.id)).innerJoin(subjects, eq(examRooms.subjectId, subjects.id)).where(eq(subjects.instructorId, session.user.id));
  const options = rows.map(({ subject, round }) => ({ id: subject.id, label: `${subject.courseCode} ${subject.courseName} · กลุ่ม ${subject.groupNo} · ${round.name}`, semester: `ภาคการศึกษา ${round.semester}/${round.academicYear}`, rooms: schedules.filter(({ schedule }) => schedule.subjectId === subject.id).map(({ schedule, room }) => ({ examRoomId: schedule.id, label: `${room.code} ${room.name} · ${schedule.examDate} ${schedule.startsAt.slice(0, 5)}–${schedule.endsAt.slice(0, 5)}`, capacity: room.capacity })) }));
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div><p className="text-sm font-medium text-primary">อาจารย์</p><h1 className="text-3xl font-semibold">ส่งข้อสอบ</h1><p className="mt-2 text-muted-foreground">เลือกวิชา กรอกแบบฟอร์มพร้อม PDF แล้วตรวจทานและส่งได้ในหน้านี้</p></div>
      <Card><CardHeader><CardTitle>แบบฟอร์มส่งข้อสอบออนไลน์</CardTitle><CardDescription>อาจารย์กำหนดจำนวนชุดต่อห้อง หน่วยโสตเพิ่มสำรองในขั้นเตรียมพิมพ์</CardDescription></CardHeader><CardContent>{options.length ? <RequestEditor subjects={options} /> : <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">ยังไม่มีรายวิชาในรอบสอบที่เปิดอยู่ กรุณาติดต่อเจ้าหน้าที่</p>}</CardContent></Card>
    </div>
  );
}
