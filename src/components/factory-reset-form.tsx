"use client";

import { LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLEAR_EXAM_DATA_PHRASE, FACTORY_RESET_PHRASE } from "@/lib/constants";

export function FactoryResetForm({ scope = "system" }: { scope?: "system" | "exam-data" }) {
  const preserveUsers = scope === "exam-data";
  const phrase = preserveUsers ? CLEAR_EXAM_DATA_PHRASE : FACTORY_RESET_PHRASE;
  const id = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [storagePending, setStoragePending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const busy = useRef(false);
  const ready = password.length > 0 && confirmation === phrase;

  async function submit() {
    if (busy.current || !ready) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/system-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: password, confirmation, scope, storageOnly: storagePending }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; storagePending?: boolean; deletedFiles?: number };
      const success = response.ok && result.ok && !result.storagePending;
      // A failed retry must never turn the next attempt into a database reset.
      if (result.storagePending) setStoragePending(true);
      else if (success) setStoragePending(false);
      const feedback = result.storagePending
        ? "ล้างข้อมูลแล้ว แต่ยังมีไฟล์ตกค้าง กรุณาลองล้างไฟล์อีกครั้ง"
        : success
          ? `${preserveUsers ? "ล้างข้อมูลงานสอบสำเร็จ เก็บผู้ใช้ทุกบัญชีไว้แล้ว" : "รีเซ็ตสำเร็จ"} ลบไฟล์ ${result.deletedFiles ?? 0} รายการ`
          : result.message || "ล้างข้อมูลไม่สำเร็จ กรุณาลองใหม่";
      setFailed(!success);
      setMessage(feedback);
      if (result.storagePending) toast.warning(feedback);
      else if (success) toast.success(feedback);
      else toast.error(feedback);
      if (success || result.storagePending) {
        setOpen(false);
        setPassword("");
        setConfirmation("");
        router.refresh();
      }
    } catch {
      const feedback = "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่";
      setFailed(true);
      setMessage(feedback);
      toast.error(feedback);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && !open ? <Alert variant={failed ? "destructive" : "default"}><AlertDescription>{message}</AlertDescription></Alert> : null}
      <AlertDialog open={open} onOpenChange={(value) => {
        if (busy.current) return;
        setOpen(value);
        setPassword("");
        setConfirmation("");
        if (value) setMessage("");
      }}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant={preserveUsers || storagePending ? "destructive" : "outline"} className="w-full sm:w-auto" disabled={pending}>
            {preserveUsers ? <Trash2 aria-hidden="true" className="size-4" /> : <RotateCcw aria-hidden="true" className="size-4" />}
            {storagePending ? "ลองล้างไฟล์ตกค้างอีกครั้ง" : preserveUsers ? "ล้างข้อมูลงานสอบ" : "Factory Reset"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-lg" onEscapeKeyDown={(event) => { if (busy.current) event.preventDefault(); }}>
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-lg font-semibold">{storagePending ? "ล้างไฟล์ตกค้าง" : preserveUsers ? "ล้างงานสอบ เก็บผู้ใช้ทั้งหมด" : "รีเซ็ตระบบและลบผู้ใช้อื่น"}</AlertDialogTitle>
            <AlertDialogDescription className="text-left leading-relaxed">
              {storagePending ? "ลบเฉพาะไฟล์ตกค้าง ไม่ล้างฐานข้อมูลซ้ำ หากมีคำขอใหม่แล้วระบบจะหยุดเพื่อป้องกันไฟล์ของงานใหม่" : preserveUsers ? "รอบสอบ รายวิชา ห้อง ตารางสอบ คำขอ งานพิมพ์ และไฟล์ทุกเวอร์ชันจะถูกลบถาวร ทุกคนยังใช้บัญชีและรหัสผ่านเดิมได้" : "ลบข้อมูลงานสอบ ไฟล์ และผู้ใช้อื่นทั้งหมด เหลือเฉพาะบัญชีของคุณและ Audit Log"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-5" aria-busy={pending}>
            <p className="border-l-2 border-destructive pl-3 text-sm font-medium text-destructive">{storagePending ? "ไฟล์ที่ลบแล้วกู้คืนไม่ได้" : "ข้อมูลที่ลบแล้วกู้คืนไม่ได้ ไม่มีระบบสำรองอัตโนมัติ"}</p>
            {message ? <Alert variant={failed ? "destructive" : "default"}><AlertDescription>{message}</AlertDescription></Alert> : null}
            <div className="space-y-2">
              <Label htmlFor={`${id}-password`}>รหัสผ่านปัจจุบัน</Label>
              <Input id={`${id}-password`} name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required disabled={pending} value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-confirmation`}>พิมพ์ {phrase}</Label>
              <Input id={`${id}-confirmation`} name="confirmation" autoComplete="off" spellCheck={false} required disabled={pending} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-describedby={`${id}-help`} />
              <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">พิมพ์ข้อความให้ตรง รวมตัวพิมพ์ใหญ่และช่องว่าง เพื่อเปิดปุ่มยืนยัน</p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction type="submit" variant="destructive" disabled={pending || !ready} onClick={(event) => { event.preventDefault(); void submit(); }}>
                {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
                {pending ? "กำลังล้างข้อมูล..." : "ยืนยันลบถาวร"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
