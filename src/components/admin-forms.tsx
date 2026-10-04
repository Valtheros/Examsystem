"use client";

import { useActionState } from "react";

import {
  createUserAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/actions/admin";
import { initialActionState } from "@/actions/types";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_ROLES } from "@/lib/constants";

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAction, initialActionState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" required placeholder="somchai.s" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">ชื่อ-นามสกุล</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">บทบาท</Label>
        <Select name="role" required>
          <SelectTrigger id="role"><SelectValue placeholder="เลือกบทบาท" /></SelectTrigger>
          <SelectContent>
            {APP_ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="initialPassword">รหัสผ่านชั่วคราว</Label>
        <Input id="initialPassword" name="initialPassword" type="password" minLength={12} required />
        <p className="text-xs text-muted-foreground">ส่งมอบให้ผู้ใช้ด้วยช่องทางที่ตกลงกัน ระบบจะไม่ใส่รหัสผ่านในอีเมล</p>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>สร้างบัญชี</SubmitButton>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetUserPasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-3 border-t py-4">
      <input type="hidden" name="userId" value={userId} />
      <ActionMessage state={state} />
      <Label htmlFor={`password-${userId}`}>รหัสผ่านชั่วคราวใหม่</Label>
      <Input id={`password-${userId}`} name="temporaryPassword" type="password" minLength={12} required />
      <SubmitButton size="sm" variant="outline">รีเซ็ตรหัสผ่าน</SubmitButton>
    </form>
  );
}

export function EditUserForm({
  record,
}: {
  record: { id: string; name: string; email: string; role: string };
}) {
  const [state, action] = useActionState(updateUserAction, initialActionState);
  return (
    <form action={action} className="grid gap-4 border-t py-4 sm:grid-cols-2">
      <input type="hidden" name="userId" value={record.id} />
      <div className="sm:col-span-2"><ActionMessage state={state} /></div>
      <div className="space-y-2">
        <Label htmlFor={`name-${record.id}`}>ชื่อ-นามสกุล</Label>
        <Input id={`name-${record.id}`} name="name" defaultValue={record.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`email-${record.id}`}>อีเมล</Label>
        <Input id={`email-${record.id}`} name="email" type="email" defaultValue={record.email} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`role-${record.id}`}>บทบาท</Label>
        <Select name="role" defaultValue={record.role} required>
          <SelectTrigger id={`role-${record.id}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {APP_ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="self-end"><SubmitButton size="sm" variant="outline">บันทึกข้อมูล</SubmitButton></div>
    </form>
  );
}
