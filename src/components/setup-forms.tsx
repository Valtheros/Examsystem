"use client";

import { useActionState } from "react";

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
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <div className="space-y-2"><Label htmlFor="name">ชื่อรอบสอบ</Label><Input id="name" name="name" placeholder="สอบกลางภาค" required /></div>
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

export function SubjectForm({ rounds, instructors }: { rounds: Option[]; instructors: Option[] }) {
  const [state, action] = useActionState(createSubjectAction, initialActionState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <SelectField name="roundId" label="รอบสอบ" options={rounds} />
      <SelectField name="instructorId" label="อาจารย์ผู้รับผิดชอบ" options={instructors} />
      <div className="space-y-2"><Label htmlFor="courseCode">รหัสวิชา</Label><Input id="courseCode" name="courseCode" required /></div>
      <div className="space-y-2"><Label htmlFor="courseName">ชื่อวิชา</Label><Input id="courseName" name="courseName" required /></div>
      <div className="space-y-2"><Label htmlFor="groupNo">กลุ่มเรียน</Label><Input id="groupNo" name="groupNo" required /></div>
      <div className="sm:col-span-2"><SubmitButton>เพิ่มรายวิชา</SubmitButton></div>
    </form>
  );
}

export function ExamRoomForm({ subjects, rooms }: { subjects: Option[]; rooms: Option[] }) {
  const [state, action] = useActionState(assignExamRoomAction, initialActionState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <SelectField name="subjectId" label="รายวิชา" options={subjects} />
      <SelectField name="roomId" label="ห้องสอบ" options={rooms} />
      <div className="space-y-2"><Label htmlFor="examDate">วันที่สอบ</Label><Input id="examDate" name="examDate" type="date" required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="startsAt">เริ่ม</Label><Input id="startsAt" name="startsAt" type="time" required /></div>
        <div className="space-y-2"><Label htmlFor="endsAt">สิ้นสุด</Label><Input id="endsAt" name="endsAt" type="time" required /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="studentCount">ผู้เข้าสอบห้องนี้</Label><Input id="studentCount" name="studentCount" type="number" min={0} required /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="note">หมายเหตุบนใบปะหน้า</Label><Textarea id="note" name="note" /></div>
      <div className="sm:col-span-2"><SubmitButton>บันทึกตารางสอบ</SubmitButton></div>
    </form>
  );
}

function SelectField({ name, label, options }: { name: string; label: string; options: Option[] }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} required>
        <SelectTrigger id={name}><SelectValue placeholder={`เลือก${label}`} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
