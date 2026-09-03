"use client";

import { useActionState } from "react";

import { createRequestAction, updateRequestAction } from "@/actions/requests";
import { initialActionState } from "@/actions/types";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SubjectOption = { id: string; label: string };

export function CreateRequestForm({ subjects }: { subjects: SubjectOption[] }) {
  const [state, action] = useActionState(createRequestAction, initialActionState);
  return (
    <form action={action} className="space-y-6">
      <ActionMessage state={state} />
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm font-semibold">1. เลือกรายวิชา</p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="subjectId">รายวิชาและรอบสอบ</Label>
          <Select name="subjectId" required>
            <SelectTrigger id="subjectId"><SelectValue placeholder="เลือกรายวิชา" /></SelectTrigger>
            <SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm font-semibold">2. ระบุข้อมูลต้นฉบับและการพิมพ์</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="pageCount">จำนวนหน้าข้อสอบ</Label><Input id="pageCount" name="pageCount" type="number" min={1} required /></div>
          <div className="space-y-2"><Label>ต้นฉบับกระดาษที่ส่ง</Label><div className="flex h-9 items-center rounded-lg border bg-background px-3 text-sm">1 ชุด</div><input name="originalCopyCount" type="hidden" value="1" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="printDetail">รายละเอียดการพิมพ์</Label><Textarea id="printDetail" name="printDetail" placeholder="เช่น พิมพ์หน้า-หลัง, หน้าที่ต้องพิมพ์สี, เอกสารแนบ" rows={5} /></div>
        </div>
      </div>
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm font-semibold">3. สร้างฉบับร่าง</p>
        <p className="mt-1 text-sm text-muted-foreground">ระบบจะดึงห้องสอบ จำนวนนักศึกษา และคำนวณจำนวนพิมพ์ต่อห้องเป็นผู้เข้าสอบ + สำรอง 1 ชุด จากนั้นคุณจึงอัปโหลด PDF และส่งตรวจ</p>
        <SubmitButton className="mt-4">สร้างคำขอและไปอัปโหลดไฟล์</SubmitButton>
      </div>
    </form>
  );
}

export function EditRequestForm({ request }: { request: { id: string; pageCount: number; originalCopyCount: number; printDetail: string | null } }) {
  const [state, action] = useActionState(updateRequestAction, initialActionState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="requestId" value={request.id} />
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <div className="space-y-2"><Label htmlFor="pageCount">จำนวนหน้า</Label><Input id="pageCount" name="pageCount" type="number" min={1} defaultValue={request.pageCount} required /></div>
      <div className="space-y-2"><Label>ต้นฉบับกระดาษ</Label><div className="flex h-9 items-center rounded-lg border bg-background px-3 text-sm">1 ชุด</div><input name="originalCopyCount" type="hidden" value="1" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="printDetail">รายละเอียดการพิมพ์</Label><Textarea id="printDetail" name="printDetail" defaultValue={request.printDetail ?? ""} rows={4} /></div>
      <div className="sm:col-span-2"><SubmitButton variant="outline">บันทึกการแก้ไข</SubmitButton></div>
    </form>
  );
}
