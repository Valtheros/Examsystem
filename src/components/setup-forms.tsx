"use client";

import { useActionState, useState } from "react";

import { assignExamRoomAction, createExamRoundAction, createRoomAction, createSubjectAction } from "@/actions/setup";
import { initialActionState } from "@/actions/types";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; label: string };

export function ExamRoundForm() {
  const [state, action] = useActionState(createExamRoundAction, initialActionState);
  const [roundType, setRoundType] = useState("กลางภาค");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <div className="space-y-2"><Label htmlFor="roundType">รอบสอบ</Label><Select value={roundType} onValueChange={setRoundType}><SelectTrigger id="roundType"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="กลางภาค">กลางภาค</SelectItem><SelectItem value="ปลายภาค">ปลายภาค</SelectItem><SelectItem value="other">รอบสอบอื่น</SelectItem></SelectContent></Select></div>
      {roundType === "other" ? <div className="space-y-2"><Label htmlFor="name">ชื่อรอบสอบอื่น</Label><Input id="name" name="name" placeholder="เช่น สอบชดเชย" maxLength={100} required /></div> : <input type="hidden" name="name" value={roundType} />}
      <div className="space-y-2"><Label htmlFor="academicYear">ปีการศึกษา</Label><Input id="academicYear" name="academicYear" placeholder="2569" required /></div>
      <div className="space-y-2"><Label htmlFor="semester">ภาคการศึกษา</Label><Input id="semester" name="semester" placeholder="1" required /></div>
      <div />
      <div className="space-y-2"><Label htmlFor="submissionStartsOn">เปิดรับต้นฉบับ</Label><Input id="submissionStartsOn" name="submissionStartsOn" type="date" /></div>
      <div className="space-y-2"><Label htmlFor="submissionEndsOn">ปิดรับต้นฉบับ</Label><Input id="submissionEndsOn" name="submissionEndsOn" type="date" /></div>
      <div className="sm:col-span-2"><SubmitButton>สร้างรอบสอบ</SubmitButton></div>
    </form>
  );
}

export function RoomForm() {
  const [state, action] = useActionState(createRoomAction, initialActionState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <div className="space-y-2"><Label htmlFor="code">รหัสห้อง</Label><Input id="code" name="code" required /></div>
      <div className="space-y-2"><Label htmlFor="roomName">ชื่อห้อง</Label><Input id="roomName" name="name" required /></div>
      <div className="space-y-2"><Label htmlFor="building">อาคาร</Label><Input id="building" name="building" /></div>
      <div className="space-y-2"><Label htmlFor="capacity">ความจุ</Label><Input id="capacity" name="capacity" type="number" min={0} required /></div>
      <div className="sm:col-span-2"><SubmitButton>เพิ่มห้องสอบ</SubmitButton></div>
    </form>
  );
}

export function SubjectForm({ rounds, instructors, initial }: { rounds: Option[]; instructors: Option[]; initial?: { id: string; roundId: string; instructorId: string; courseCode: string; courseName: string; groupNo: string } }) {
  const [state, action] = useActionState(createSubjectAction, initialActionState);
  if (!rounds.length || !instructors.length) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{!rounds.length ? "กรุณาสร้างรอบสอบที่หน้า รอบสอบ ก่อนเพิ่มรายวิชา" : "ยังไม่มีอาจารย์ที่เปิดใช้งาน กรุณาให้ผู้ดูแลระบบสร้างบัญชีอาจารย์ก่อน"}</p>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <input type="hidden" name="editSubjectId" value={initial?.id ?? ""} />
      <SelectField name="roundId" label="รอบสอบ" options={rounds} defaultValue={initial?.roundId} />
      <SelectField name="instructorId" label="อาจารย์ผู้รับผิดชอบ" options={instructors} defaultValue={initial?.instructorId} />
      <div className="space-y-2"><Label htmlFor="courseCode">รหัสวิชา</Label><Input id="courseCode" name="courseCode" defaultValue={initial?.courseCode} required /></div>
      <div className="space-y-2"><Label htmlFor="courseName">ชื่อวิชา</Label><Input id="courseName" name="courseName" defaultValue={initial?.courseName} required /></div>
      <div className="space-y-2"><Label htmlFor="groupNo">กลุ่มเรียน</Label><Input id="groupNo" name="groupNo" defaultValue={initial?.groupNo} required /></div>
      <div className="sm:col-span-2"><SubmitButton>{initial ? "บันทึกแก้ไขรายวิชา" : "เพิ่มรายวิชา"}</SubmitButton></div>
    </form>
  );
}

export function ExamRoomForm({ subjects, rooms, initial }: { subjects: Option[]; rooms: Option[]; initial?: { id: string; subjectId: string; roomId: string; examDate: string; startsAt: string; endsAt: string; note: string | null } }) {
  const [state, action] = useActionState(assignExamRoomAction, initialActionState);
  if (!subjects.length || !rooms.length) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{!subjects.length ? "กรุณาเพิ่มรายวิชาในรอบสอบที่เปิดอยู่ก่อนจัดตารางสอบ" : "กรุณาเพิ่มห้องที่หน้า ห้องสอบ ก่อนจัดตารางสอบ"}</p>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <input type="hidden" name="examRoomId" value={initial?.id ?? ""} />
      <SelectField name="subjectId" label="รายวิชา" options={subjects} defaultValue={initial?.subjectId} />
      <SelectField name="roomId" label="ห้องสอบ" options={rooms} defaultValue={initial?.roomId} />
      <div className="space-y-2"><Label htmlFor="examDate">วันที่สอบ</Label><Input id="examDate" name="examDate" type="date" defaultValue={initial?.examDate} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="startsAt">เริ่ม</Label><Input id="startsAt" name="startsAt" type="time" defaultValue={initial?.startsAt.slice(0, 5)} required /></div>
        <div className="space-y-2"><Label htmlFor="endsAt">สิ้นสุด</Label><Input id="endsAt" name="endsAt" type="time" defaultValue={initial?.endsAt.slice(0, 5)} required /></div>
      </div>
      <p className="text-sm text-muted-foreground sm:col-span-2">เจ้าหน้าที่จัดห้องและเวลา ส่วนจำนวนชุดข้อสอบให้อาจารย์กรอกเมื่อส่งข้อสอบ</p>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="note">หมายเหตุบนใบปะหน้า</Label><Textarea id="note" name="note" defaultValue={initial?.note ?? ""} /></div>
      <div className="sm:col-span-2"><SubmitButton>บันทึกตารางสอบ</SubmitButton></div>
    </form>
  );
}

function SelectField({ name, label, options, defaultValue }: { name: string; label: string; options: Option[]; defaultValue?: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} required defaultValue={defaultValue}>
        <SelectTrigger id={name}><SelectValue placeholder={`เลือก${label}`} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
