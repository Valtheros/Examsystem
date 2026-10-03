import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";

import { ExamRoomForm, SubjectForm } from "@/components/setup-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRequests, examRooms, examRounds, rooms, subjects, user } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ editSubject?: string; editSchedule?: string }> }) {
  const query = await searchParams;
  await requirePageRole([ROLES.OFFICER]);
  const [roundRows, instructorRows, roomRows, subjectRows, schedules, activeRequests] = await Promise.all([
    db.select().from(examRounds).where(eq(examRounds.isActive, true)).orderBy(asc(examRounds.academicYear)),
    db.select().from(user).where(and(eq(user.role, ROLES.INSTRUCTOR), eq(user.banned, false))).orderBy(asc(user.name)),
    db.select().from(rooms).where(eq(rooms.isActive, true)).orderBy(asc(rooms.code)),
    db.select({ subject: subjects, round: examRounds, instructorName: user.name }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).innerJoin(user, eq(subjects.instructorId, user.id)).orderBy(asc(subjects.courseCode)),
    db.select({ schedule: examRooms, room: rooms, subject: subjects }).from(examRooms).innerJoin(rooms, eq(examRooms.roomId, rooms.id)).innerJoin(subjects, eq(examRooms.subjectId, subjects.id)).orderBy(asc(examRooms.examDate), asc(examRooms.startsAt)),
    db.select({ subjectId: examRequests.subjectId }).from(examRequests).where(isNull(examRequests.cancelledAt)),
  ]);
  const locked = new Set(activeRequests.map((request) => request.subjectId));
  const editSubject = subjectRows.find(({ subject }) => subject.id === query.editSubject && !locked.has(subject.id))?.subject;
  const editSchedule = schedules.find(({ schedule }) => schedule.id === query.editSchedule && !locked.has(schedule.subjectId))?.schedule;
  const roundOptions = roundRows.map((round) => ({ id: round.id, label: `${round.name} · ${round.academicYear}/${round.semester}` }));
  const instructorOptions = instructorRows.map((instructor) => ({ id: instructor.id, label: `${instructor.name} (${instructor.username})` }));
  const roomOptions = roomRows.map((room) => ({ id: room.id, label: `${room.code} ${room.name} · ${room.capacity} ที่นั่ง` }));
  const subjectOptions = subjectRows.filter(({ round }) => round.isActive).map(({ subject, round }) => ({ id: subject.id, label: `${subject.courseCode} ${subject.courseName} กลุ่ม ${subject.groupNo} · ${round.name} ${round.academicYear}/${round.semester}` }));
  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div><p className="text-sm font-medium text-primary">เจ้าหน้าที่</p><h1 className="text-3xl font-semibold">รายวิชาและตารางสอบ</h1><p className="mt-2 text-muted-foreground">รายวิชาหนึ่งมีหลายห้อง และห้องเดียวมีหลายรายวิชาได้ในคนละช่วงเวลา</p></div>
      {editSubject || editSchedule ? <p className="text-sm">กำลังแก้ไขข้อมูล · <Link href="/dashboard/subjects" className="text-primary underline">กลับไปเพิ่มรายการใหม่</Link></p> : null}<div className="space-y-6">
        <Card><CardHeader><CardTitle>1. เพิ่มรายวิชา</CardTitle><CardDescription>ผูกรายวิชากับรอบสอบและอาจารย์ผู้รับผิดชอบ</CardDescription></CardHeader><CardContent><SubjectForm key={editSubject?.id ?? "new"} rounds={roundOptions} instructors={instructorOptions} initial={editSubject} /></CardContent></Card>
        <Card><CardHeader><CardTitle>2. เพิ่มห้องและเวลาให้รายวิชา</CardTitle><CardDescription>เจ้าหน้าที่เลือกห้องตามความจุและเวลาว่าง อาจารย์กำหนดจำนวนข้อสอบภายหลัง</CardDescription></CardHeader><CardContent><ExamRoomForm key={editSchedule?.id ?? "new"} subjects={subjectOptions} rooms={roomOptions} initial={editSchedule} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>รายวิชา</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>รายวิชา</TableHead><TableHead>กลุ่ม</TableHead><TableHead>รอบสอบ</TableHead><TableHead>อาจารย์</TableHead><TableHead>จัดการ</TableHead></TableRow></TableHeader><TableBody>{subjectRows.map(({ subject, round, instructorName }) => <TableRow key={subject.id}><TableCell><p className="font-medium">{subject.courseCode}</p><p className="text-xs text-muted-foreground">{subject.courseName}</p></TableCell><TableCell>{subject.groupNo}</TableCell><TableCell>{round.name} · {round.academicYear}/{round.semester}</TableCell><TableCell>{instructorName}</TableCell><TableCell>{locked.has(subject.id) ? "มีคำขอแล้ว · ล็อกข้อมูล" : <Link className="text-primary underline" href={`?editSubject=${subject.id}`}>แก้ไขรายวิชา</Link>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card><CardHeader><CardTitle>ตารางสอบแยกห้อง</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>รายวิชา</TableHead><TableHead>ห้อง</TableHead><TableHead>วันเวลา</TableHead><TableHead>ความจุ</TableHead><TableHead>จัดการ</TableHead></TableRow></TableHeader><TableBody>{schedules.map(({ schedule, room, subject }) => <TableRow key={schedule.id}><TableCell>{subject.courseCode} กลุ่ม {subject.groupNo}</TableCell><TableCell>{room.code} {room.name}</TableCell><TableCell>{schedule.examDate} · {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}</TableCell><TableCell>{room.capacity} คน</TableCell><TableCell>{locked.has(subject.id) ? "มีคำขอแล้ว · ล็อกตาราง" : <Link className="text-primary underline" href={`?editSchedule=${schedule.id}`}>แก้ไขตาราง</Link>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </div>
  );
}
