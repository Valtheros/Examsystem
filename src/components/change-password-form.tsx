"use client";

import { useActionState } from "react";

import { changeInitialPasswordAction } from "@/actions/account";
import { initialActionState } from "@/actions/types";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeInitialPasswordAction, initialActionState);
  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader>
        <CardTitle>ตั้งรหัสผ่านส่วนตัว</CardTitle>
        <CardDescription>
          นี่คือการเข้าสู่ระบบครั้งแรก กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งานระบบ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-5">
          <ActionMessage state={state} />
          <div className="space-y-2">
            <Label htmlFor="currentPassword">รหัสผ่านชั่วคราว</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
            <p className="text-xs text-muted-foreground">อย่างน้อย 12 ตัวอักษร และมีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
          </div>
          <SubmitButton className="w-full" size="lg">บันทึกรหัสผ่านใหม่</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
