import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { BookOpen, CalendarDays, Plus, X } from "lucide-react";

import { ExamRoomForm, SubjectForm } from "@/components/setup-forms";
import { SetupRowActions } from "@/components/delete-setup-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRequests, examRooms, examRounds, requestRooms, rooms, subjects, user } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ editSubject?: string; editSchedule?: string; new?: string }> }) {
  const query = await searchParams;
  await requirePageRole([ROLES.OFFICER]);
  const [roundRows, instructorRows, roomRows, subjectRows, schedules, requests, referencedRooms] = await Promise.all([
    db.select().from(examRounds).where(eq(examRounds.isActive, true)).orderBy(asc(examRounds.academicYear)),
    db.select().from(user).where(and(eq(user.role, ROLES.INSTRUCTOR), eq(user.banned, false))).orderBy(asc(user.name)),
    db.select().from(rooms).where(eq(rooms.isActive, true)).orderBy(asc(rooms.code)),
    db.select({ subject: subjects, round: examRounds, instructorName: user.name }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).innerJoin(user, eq(subjects.instructorId, user.id)).orderBy(asc(subjects.courseCode)),
    db.select({ schedule: examRooms, room: rooms, subject: subjects }).from(examRooms).innerJoin(rooms, eq(examRooms.roomId, rooms.id)).innerJoin(subjects, eq(examRooms.subjectId, subjects.id)).orderBy(asc(examRooms.examDate), asc(examRooms.startsAt)),
    db.select({ subjectId: examRequests.subjectId, cancelledAt: examRequests.cancelledAt }).from(examRequests),
    db.select({ examRoomId: requestRooms.examRoomId }).from(requestRooms),
  ]);
  const locked = new Set(requests.filter(request => !request.cancelledAt).map(request => request.subjectId));
  const history = new Set(requests.map(request => request.subjectId));
  const usedSchedules = new Set(referencedRooms.map(room => room.examRoomId));
  const editSubject = subjectRows.find(({ subject }) => subject.id === query.editSubject && !locked.has(subject.id))?.subject;
  const editSchedule = !query.editSubject ? schedules.find(({ schedule }) => schedule.id === query.editSchedule && !locked.has(schedule.subjectId))?.schedule : undefined;
  const showSubjectForm = !!editSubject || (!editSchedule && query.new === "subject");
  const showScheduleForm = !!editSchedule || (!editSubject && query.new === "schedule");
  const lockedReason = "มีคำขอในรายวิชานี้แล้ว จึงแก้ไขหรือลบไม่ได้ เพื่อรักษารายละเอียดคำขอและตารางสอบเดิม";
  const roundOptions = roundRows.map((round) => ({ id: round.id, label: `${round.name} · ${round.academicYear}/${round.semester}` }));
  const instructorOptions = instructorRows.map((instructor) => ({ id: instructor.id, label: `${instructor.name} (${instructor.username})` }));
  const roomOptions = roomRows.map((room) => ({ id: room.id, label: `${room.code} ${room.name} · ${room.capacity} ที่นั่ง` }));
  const subjectOptions = subjectRows.filter(({ round, subject }) => round.isActive && !locked.has(subject.id)).map(({ subject, round }) => ({ id: subject.id, label: `${subject.courseCode} ${subject.courseName} กลุ่ม ${subject.groupNo} · ${round.name} ${round.academicYear}/${round.semester}` }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">รายวิชาและตารางสอบ</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">เพิ่มรายวิชา แล้วจัดห้องและเวลา ห้องเดียวใช้หลายวิชาได้ในคนละช่วงเวลา</p></div>
        {!showSubjectForm && !showScheduleForm ? <div className="flex flex-wrap gap-2"><Button asChild><Link href="?new=subject#subject-form"><Plus aria-hidden="true" />เพิ่มรายวิชา</Link></Button><Button asChild variant="outline"><Link href="?new=schedule#schedule-form"><CalendarDays aria-hidden="true" />จัดตารางสอบ</Link></Button></div> : null}
      </div>
      {(query.editSubject && !editSubject) || (query.editSchedule && !editSchedule) ? <Alert><AlertDescription>ไม่พบรายการที่แก้ไขได้ หรือรายวิชานี้มีคำขอแล้ว</AlertDescription></Alert> : null}
      {showSubjectForm ? <Card id="subject-form" className="scroll-mt-24"><CardHeader><CardTitle>{editSubject ? "แก้ไขรายวิชา" : "เพิ่มรายวิชา"}</CardTitle><CardDescription>เลือกคณะ รอบสอบ และอาจารย์ผู้รับผิดชอบ</CardDescription><CardAction><Button asChild variant="ghost" size="sm"><Link href="/dashboard/subjects"><X aria-hidden="true" />ปิดฟอร์ม</Link></Button></CardAction></CardHeader><CardContent><SubjectForm key={editSubject?.id ?? "new"} rounds={roundOptions} instructors={instructorOptions} initial={editSubject} /></CardContent></Card> : null}
      {showScheduleForm ? <Card id="schedule-form" className="scroll-mt-24"><CardHeader><CardTitle>{editSchedule ? "แก้ไขตารางสอบ" : "จัดตารางสอบ"}</CardTitle><CardDescription>เลือกวิชา ห้อง และเวลา อาจารย์จะกำหนดจำนวนข้อสอบภายหลัง</CardDescription><CardAction><Button asChild variant="ghost" size="sm"><Link href="/dashboard/subjects"><X aria-hidden="true" />ปิดฟอร์ม</Link></Button></CardAction></CardHeader><CardContent><ExamRoomForm key={editSchedule?.id ?? "new"} subjects={subjectOptions} rooms={roomOptions} initial={editSchedule} /></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>รายวิชา <span className="ml-2 text-sm font-normal text-muted-foreground">{subjectRows.length} วิชา</span></CardTitle></CardHeader><CardContent><Table><TableHeader className="bg-muted/50"><TableRow><TableHead>รายวิชา</TableHead><TableHead className="hidden sm:table-cell">กลุ่ม</TableHead><TableHead className="hidden sm:table-cell">รอบสอบ</TableHead><TableHead className="hidden md:table-cell">อาจารย์</TableHead><TableHead className="w-24 text-right sm:w-48">จัดการ</TableHead></TableRow></TableHeader><TableBody>
        {subjectRows.map(({ subject, round, instructorName }) => <TableRow key={subject.id}>
          <TableCell className="min-w-32 max-w-64 whitespace-normal sm:min-w-48"><p className="break-all font-medium text-primary">{subject.courseCode}</p><p className="mt-1 text-sm">{subject.courseName}</p><p className="mt-1 text-xs text-muted-foreground">{subject.facultyName ?? "ยังไม่ระบุคณะ"}</p><p className="mt-1 text-xs text-muted-foreground sm:hidden">กลุ่ม {subject.groupNo} · {round.name} {round.academicYear}/{round.semester}</p><p className="mt-1 text-xs text-muted-foreground md:hidden">{instructorName}</p></TableCell>
          <TableCell className="hidden tabular-nums sm:table-cell">{subject.groupNo}</TableCell><TableCell className="hidden sm:table-cell"><p>{round.name}</p><p className="mt-1 text-xs text-muted-foreground">{round.academicYear} / {round.semester}</p></TableCell><TableCell className="hidden max-w-40 whitespace-normal md:table-cell">{instructorName}</TableCell>
          <TableCell><SetupRowActions kind="subject" id={subject.id} label={`${subject.courseCode} ${subject.courseName}`} editHref={`?editSubject=${subject.id}#subject-form`} editDisabledReason={locked.has(subject.id) ? lockedReason : undefined} deleteDisabledReason={history.has(subject.id) ? "มีประวัติคำขอแล้ว จึงลบรายวิชาไม่ได้" : undefined} /></TableCell>
        </TableRow>)}
        {!subjectRows.length ? <TableRow><TableCell colSpan={5} className="py-12 text-center"><BookOpen className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true" /><p className="font-medium">ยังไม่มีรายวิชา</p><p className="mt-1 text-sm text-muted-foreground">กดเพิ่มรายวิชา แล้วเลือกอาจารย์ผู้รับผิดชอบ</p></TableCell></TableRow> : null}
      </TableBody></Table></CardContent></Card>
      <Card><CardHeader><CardTitle>ตารางสอบแยกห้อง <span className="ml-2 text-sm font-normal text-muted-foreground">{schedules.length} รายการ</span></CardTitle></CardHeader><CardContent><Table><TableHeader className="bg-muted/50"><TableRow><TableHead>รายวิชา</TableHead><TableHead className="hidden sm:table-cell">ห้องสอบ</TableHead><TableHead className="hidden sm:table-cell">วัน / เวลา</TableHead><TableHead className="hidden md:table-cell">ความจุ</TableHead><TableHead className="w-24 text-right sm:w-48">จัดการ</TableHead></TableRow></TableHeader><TableBody>
        {schedules.map(({ schedule, room, subject }) => <TableRow key={schedule.id}>
          <TableCell className="max-w-56 whitespace-normal"><p className="break-all font-medium text-primary">{subject.courseCode}</p><p className="mt-1 text-xs text-muted-foreground">กลุ่ม {subject.groupNo}</p><div className="mt-2 space-y-1 text-xs sm:hidden"><p>{room.name} ({room.code})</p><p>{schedule.examDate}</p><p className="tabular-nums text-muted-foreground">{schedule.startsAt.slice(0, 5)} - {schedule.endsAt.slice(0, 5)}</p></div><p className="mt-1 text-xs text-muted-foreground md:hidden">ความจุ {room.capacity} คน</p></TableCell>
          <TableCell className="hidden sm:table-cell"><p className="font-medium">{room.name}</p><p className="mt-1 text-xs text-muted-foreground">{room.code}</p></TableCell>
          <TableCell className="hidden sm:table-cell"><p className="tabular-nums">{schedule.examDate}</p><p className="mt-1 text-xs tabular-nums text-muted-foreground">{schedule.startsAt.slice(0, 5)} - {schedule.endsAt.slice(0, 5)}</p></TableCell><TableCell className="hidden tabular-nums md:table-cell">{room.capacity} คน</TableCell>
          <TableCell><SetupRowActions kind="schedule" id={schedule.id} label={`${subject.courseCode} ${room.name} ${schedule.examDate}`} editHref={`?editSchedule=${schedule.id}#schedule-form`} editDisabledReason={locked.has(subject.id) ? lockedReason : undefined} deleteDisabledReason={usedSchedules.has(schedule.id) ? "ตารางสอบมีประวัติคำขออ้างอิงแล้ว จึงลบไม่ได้" : undefined} /></TableCell>
        </TableRow>)}
        {!schedules.length ? <TableRow><TableCell colSpan={5} className="py-12 text-center"><CalendarDays className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true" /><p className="font-medium">ยังไม่มีตารางสอบ</p><p className="mt-1 text-sm text-muted-foreground">กดจัดตารางสอบเพื่อเลือกห้องและเวลาให้รายวิชา</p></TableCell></TableRow> : null}
      </TableBody></Table></CardContent></Card>
    </div>
  );
}
