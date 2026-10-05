"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSetupAction } from "@/actions/setup";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function DeleteSetupDialog({ kind, id, label, disabledReason }: { kind: "room" | "subject" | "schedule"; id: string; label: string; disabledReason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const data = new FormData(); data.set("kind", kind); data.set("id", id);
      const result = await deleteSetupAction(initialActionState, data);
      if (!result.ok) { setError(result.message); return; }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    } catch { setError("เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่"); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="space-y-1"><AlertDialog open={open} onOpenChange={value => { if (!busy.current) { setOpen(value); setError(""); } }}>
    <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive" disabled={!!disabledReason}>ลบ</Button></AlertDialogTrigger>
    <AlertDialogContent onEscapeKeyDown={event => { if (busy.current) event.preventDefault(); }}>
      <AlertDialogHeader><AlertDialogTitle>ยืนยันลบรายการ?</AlertDialogTitle><AlertDialogDescription>ลบ {label}{kind === "subject" ? " และตารางสอบของวิชานี้ที่ยังไม่ถูกใช้ในคำขอ" : ""} การลบกู้คืนไม่ได้ ระบบจะไม่ลบคำขอหรือไฟล์ข้อสอบที่มีประวัติอ้างอิง</AlertDialogDescription></AlertDialogHeader>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>กลับไปตรวจทาน</AlertDialogCancel><AlertDialogAction disabled={pending} className="bg-destructive text-white hover:bg-destructive/90" onClick={event => { event.preventDefault(); void remove(); }}>{pending ? "กำลังลบ..." : "ยืนยันลบ"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>{disabledReason ? <p className="max-w-64 whitespace-normal text-xs text-muted-foreground">{disabledReason}</p> : null}</div>;
}
