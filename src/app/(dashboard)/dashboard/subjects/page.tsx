import { asc, eq } from "drizzle-orm";

import { ExamRoomForm, SubjectForm } from "@/components/setup-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRooms, examRounds, rooms, subjects, user } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function SubjectsPage() {
  await requirePageRole([ROLES.OFFICER]);
  const [roundRows, instructorRows, roomRows, subjectRows, schedules] = await Promise.all([
    db.select().from(examRounds).orderBy(asc(examRounds.academicYear)),
    db.select().from(user).where(eq(user.role, ROLES.INSTRUCTOR)).orderBy(asc(user.name)),
    db.select().from(rooms).where(eq(rooms.isActive, true)).orderBy(asc(rooms.code)),
    db.select({ subject: subjects, round: examRounds, instructorName: user.name }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).innerJoin(user, eq(subjects.instructorId, user.id)).orderBy(asc(subjects.courseCode)),
    db.select({ schedule: examRooms, room: rooms, subject: subjects }).from(examRooms).innerJoin(rooms, eq(examRooms.roomId, rooms.id)).innerJoin(subjects, eq(examRooms.subjectId, subjects.id)).orderBy(asc(examRooms.examDate), asc(examRooms.startsAt)),
  ]);
  const roundOptions = roundRows.map((round) => ({ id: round.id, label: `${round.name} · ${round.academicYear}/${round.semester}` }));
  const instructorOptions = instructorRows.map((instructor) => ({ id: instructor.id, label: `${instructor.name} (${instructor.username})` }));
  const roomOptions = roomRows.map((room) => ({ id: room.id, label: `${room.code} ${room.name} · ${room.capacity} ที่นั่ง` }));
  const subjectOptions = subjectRows.map(({ subject, round }) => ({ id: subject.id, label: `${subject.courseCode} ${subject.courseName} กลุ่ม ${subject.groupNo} · ${round.name}` }));
  return (
    <div className="space-y-7">
      <div><p className="text-sm font-medium text-primary">เจ้าหน้าที่</p><h1 className="text-3xl font-semibold">รายวิชาและตารางสอบ</h1><p className="mt-2 text-muted-foreground">รายวิชาหนึ่งมีหลายห้อง และห้องเดียวมีหลายรายวิชาได้ในคนละช่วงเวลา</p></div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>1. เพิ่มรายวิชา</CardTitle><CardDescription>ผูกรายวิชากับรอบสอบและอาจารย์ผู้รับผิดชอบ</CardDescription></CardHeader><CardContent><SubjectForm rounds={roundOptions} instructors={instructorOptions} /></CardContent></Card>
        <Card><CardHeader><CardTitle>2. เพิ่มห้องและเวลาให้รายวิชา</CardTitle><CardDescription>ExamRoom เป็นตารางกลางที่รองรับ many-to-many</CardDescription></CardHeader><CardContent><ExamRoomForm subjects={subjectOptions} rooms={roomOptions} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>รายวิชา</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>รายวิชา</TableHead><TableHead>กลุ่ม</TableHead><TableHead>รอบสอบ</TableHead><TableHead>อาจารย์</TableHead></TableRow></TableHeader><TableBody>{subjectRows.map(({ subject, round, instructorName }) => <TableRow key={subject.id}><TableCell><p className="font-medium">{subject.courseCode}</p><p className="text-xs text-muted-foreground">{subject.courseName}</p></TableCell><TableCell>{subject.groupNo}</TableCell><TableCell>{round.name} · {round.academicYear}/{round.semester}</TableCell><TableCell>{instructorName}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card><CardHeader><CardTitle>ตารางสอบแยกห้อง</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>รายวิชา</TableHead><TableHead>ห้อง</TableHead><TableHead>วันเวลา</TableHead><TableHead>ผู้เข้าสอบ</TableHead><TableHead>จำนวนพิมพ์</TableHead></TableRow></TableHeader><TableBody>{schedules.map(({ schedule, room, subject }) => <TableRow key={schedule.id}><TableCell>{subject.courseCode} กลุ่ม {subject.groupNo}</TableCell><TableCell>{room.code} {room.name}</TableCell><TableCell>{schedule.examDate} · {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}</TableCell><TableCell>{schedule.studentCount}</TableCell><TableCell>{schedule.studentCount + 1}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </div>
  );
}
