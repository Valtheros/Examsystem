"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FACTORY_RESET_PHRASE } from "@/lib/constants";

export function FactoryResetForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [storagePending, setStoragePending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);

  async function submit() {
    if (busy.current || !formRef.current) return;
    const data = new FormData(formRef.current);
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/system-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          confirmation: data.get("confirmation"),
          storageOnly: storagePending,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; storagePending?: boolean; deletedFiles?: number };
      const success = response.ok && result.ok && !result.storagePending;
      // A failed retry must not turn the next attempt back into a full database reset.
      if (result.storagePending) setStoragePending(true);
      else if (success) setStoragePending(false);
      const feedback = result.storagePending
        ? "ล้างข้อมูลแล้ว แต่ยังมีไฟล์ตกค้าง กรุณาลองล้างไฟล์อีกครั้ง"
        : success ? `รีเซ็ตสำเร็จ ลบไฟล์ ${result.deletedFiles ?? 0} รายการ` : result.message || "รีเซ็ตไม่สำเร็จ";
      setFailed(!success);
      setMessage(feedback);
      if (result.storagePending) toast.warning(feedback);
      else if (success) toast.success(feedback);
      else toast.error(feedback);
      if (success) formRef.current.reset();
    } catch (error) {
      const feedback = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
      setFailed(true);
      setMessage(feedback);
      toast.error(feedback);
    } finally {
      busy.current = false;
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); setOpen(true); }} className="space-y-5">
      <Alert variant="destructive">
        <TriangleAlert className="size-4" />
        <AlertTitle>การดำเนินการนี้กู้คืนไม่ได้</AlertTitle>
        <AlertDescription>ระบบจะเก็บเฉพาะบัญชีผู้ดูแลที่กำลังใช้งานและ Audit Log เดิม ข้อมูลอื่นและไฟล์ทั้งหมดจะถูกลบ</AlertDescription>
      </Alert>
      {message ? <Alert variant={failed ? "destructive" : "default"}><AlertDescription>{message}</AlertDescription></Alert> : null}
      <div className="space-y-2"><Label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</Label><Input id="currentPassword" name="currentPassword" type="password" required /></div>
      <div className="space-y-2"><Label htmlFor="confirmation">พิมพ์ {FACTORY_RESET_PHRASE}</Label><Input id="confirmation" name="confirmation" autoComplete="off" required /></div>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
        {storagePending ? "ลองล้างไฟล์ตกค้างอีกครั้ง" : "Factory Reset"}
      </Button>
      <AlertDialog open={open} onOpenChange={(value) => { if (!busy.current) setOpen(value); }}>
        <AlertDialogContent onEscapeKeyDown={(event) => { if (busy.current) event.preventDefault(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>{storagePending ? "ยืนยันล้างไฟล์ตกค้าง" : "ยืนยันล้างระบบ"}</AlertDialogTitle>
            <AlertDialogDescription>{storagePending ? "ระบบจะลองลบไฟล์ที่ตกค้างจากการรีเซ็ตครั้งก่อนอีกครั้ง" : "ข้อมูลผู้ใช้อื่น รอบสอบ คำขอ และไฟล์ข้อสอบทั้งหมดจะถูกลบถาวร เหลือเฉพาะบัญชีของคุณและประวัติการใช้งาน การดำเนินการนี้กู้คืนไม่ได้"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={(event) => { event.preventDefault(); void submit(); }}>
              {pending ? "กำลังล้างข้อมูล..." : "ยืนยันลบถาวร"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
