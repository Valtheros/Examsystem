"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FACTORY_RESET_PHRASE } from "@/lib/constants";

export function FactoryResetForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [storagePending, setStoragePending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, storageOnly = false) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/system-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          confirmation: data.get("confirmation"),
          storageOnly,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; storagePending?: boolean; deletedFiles?: number };
      setStoragePending(Boolean(result.storagePending));
      setMessage(result.ok ? `รีเซ็ตสำเร็จ ลบไฟล์ ${result.deletedFiles ?? 0} รายการ` : result.message || "รีเซ็ตไม่สำเร็จ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => submit(event, storagePending)} className="space-y-5">
      <Alert variant="destructive">
        <TriangleAlert className="size-4" />
        <AlertTitle>การดำเนินการนี้กู้คืนไม่ได้</AlertTitle>
        <AlertDescription>ระบบจะเก็บเฉพาะบัญชีผู้ดูแลที่กำลังใช้งานและ Audit Log เดิม ข้อมูลอื่นและไฟล์ทั้งหมดจะถูกลบ</AlertDescription>
      </Alert>
      {message ? <Alert variant={storagePending ? "destructive" : "default"}><AlertDescription>{message}</AlertDescription></Alert> : null}
      <div className="space-y-2"><Label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</Label><Input id="currentPassword" name="currentPassword" type="password" required /></div>
      <div className="space-y-2"><Label htmlFor="confirmation">พิมพ์ {FACTORY_RESET_PHRASE}</Label><Input id="confirmation" name="confirmation" autoComplete="off" required /></div>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
        {storagePending ? "ลองล้างไฟล์ตกค้างอีกครั้ง" : "Factory Reset"}
      </Button>
    </form>
  );
}
