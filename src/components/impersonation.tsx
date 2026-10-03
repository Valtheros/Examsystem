"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function ImpersonateButton({ userId, username, disabledReason }: { userId: string; username: string; disabledReason?: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  async function start() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await authClient.admin.impersonateUser({ userId });
      if (result.error) { setError(result.error.message || "เข้าใช้งานแทนไม่สำเร็จ"); return; }
      // Full navigation clears cached pages and permissions from the previous identity.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch { setError("เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่"); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="space-y-1"><AlertDialog open={open} onOpenChange={(value) => { if (!busy.current) { setOpen(value); setError(""); } }}>
    <AlertDialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={pending || !!disabledReason}>เข้าใช้งานแทน</Button></AlertDialogTrigger>
    <AlertDialogContent onEscapeKeyDown={(event) => { if (busy.current) event.preventDefault(); }}>
      <AlertDialogHeader><AlertDialogTitle>ยืนยันเข้าใช้งานแทน</AlertDialogTitle><AlertDialogDescription>คุณกำลังจะเข้าใช้งานแทน <strong className="break-all text-foreground">{username}</strong> การแก้ไขและส่งคำขอมีผลจริงตามสิทธิ์ของบัญชีนี้ ไม่ใช่โหมดดูตัวอย่าง คุณสามารถกดกลับบัญชีผู้ดูแลได้จากแถบด้านล่าง</AlertDialogDescription></AlertDialogHeader>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void start(); }}>{pending ? "กำลังเข้าใช้งาน..." : "ยืนยันเข้าใช้งานแทน"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>{disabledReason && <p className="max-w-64 whitespace-normal text-xs text-muted-foreground">{disabledReason}</p>}</div>;
}

export function ImpersonationBanner() {
  const { data } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!data?.session.impersonatedBy) return null;
  async function stop() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.admin.stopImpersonating();
      if (result.error) { const message = "กลับบัญชีเดิมไม่สำเร็จ กรุณาลองใหม่ หรือออกจากระบบแล้วเข้าสู่ระบบผู้ดูแลอีกครั้ง"; setError(message); toast.error(message); return; }
      // Discard the impersonated identity's client cache when restoring the session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard/users");
    } catch { setError("เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่"); toast.error("เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่"); }
    finally { setPending(false); }
  }
  return <><div className="h-36 sm:h-24" /><aside aria-label="โหมดเข้าใช้งานแทน" className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-lg"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">กำลังเข้าใช้งานแทน {data.user.name}</p><p className="text-sm">การดำเนินการมีผลจริงตามสิทธิ์บัญชีนี้ · session สูงสุด 1 ชั่วโมง</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div><Button type="button" onClick={stop} disabled={pending}>{pending ? "กำลังกลับ..." : "กลับบัญชีผู้ดูแลระบบ"}</Button></div></aside></>;
}
