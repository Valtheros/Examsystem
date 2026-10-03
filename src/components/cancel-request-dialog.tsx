"use client";

import { cancelWithFeedback } from "@/actions/workflow-feedback";
import { WorkflowForm } from "@/components/workflow-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function CancelRequestDialog({ requestId }: { requestId: string }) {
  return <AlertDialog>
    <AlertDialogTrigger asChild><Button className="w-full" variant="destructive">ยกเลิกคำขอ</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>ยืนยันยกเลิกคำขอนี้?</AlertDialogTitle><AlertDialogDescription>คำขอจะไม่ปรากฏในงานปัจจุบัน แต่ไฟล์และประวัติเดิมยังคงอยู่ หากต้องการส่งใหม่ให้สร้างคำขอใหม่</AlertDialogDescription></AlertDialogHeader>
      <WorkflowForm action={cancelWithFeedback}>
        <input type="hidden" name="requestId" value={requestId} />
        <Label htmlFor="cancelReason">เหตุผลการยกเลิก (ถ้ามี)</Label><Textarea id="cancelReason" name="reason" maxLength={1000} />
        <AlertDialogFooter><AlertDialogCancel>กลับไปตรวจทาน</AlertDialogCancel><SubmitButton variant="destructive">ยืนยันยกเลิกคำขอ</SubmitButton></AlertDialogFooter>
      </WorkflowForm>
    </AlertDialogContent>
  </AlertDialog>;
}
