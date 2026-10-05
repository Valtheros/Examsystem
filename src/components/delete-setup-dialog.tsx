"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSetupAction } from "@/actions/setup";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type SetupKind = "round" | "room" | "subject" | "schedule";
type SetupActionsProps = { kind: SetupKind; id: string; label: string; editHref: string; editDisabledReason?: string; deleteDisabledReason?: string };

export function SetupRowActions({ editHref, editDisabledReason, deleteDisabledReason, ...props }: SetupActionsProps) {
  const editLabel = { round: "แก้ไขรอบสอบ", room: "แก้ไขห้อง", subject: "แก้ไขรายวิชา", schedule: "แก้ไขตาราง" }[props.kind];
  return <div className="flex items-center justify-end gap-2">
    {!editDisabledReason ? <Button asChild size="sm" variant="outline"><Link href={editHref} aria-label={editLabel}><Pencil aria-hidden="true" /><span className="hidden sm:inline">แก้ไข</span></Link></Button> : null}
    <DeleteSetupDialog {...props} disabledReason={editDisabledReason ?? deleteDisabledReason} locked={!!editDisabledReason} />
  </div>;
}

function DeleteSetupDialog({ kind, id, label, disabledReason, locked }: { kind: SetupKind; id: string; label: string; disabledReason?: string; locked: boolean }) {
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
  return <AlertDialog open={open} onOpenChange={value => { if (!busy.current) { setOpen(value); setError(""); } }}>
    <AlertDialogTrigger asChild><Button size="sm" variant={disabledReason ? "ghost" : "outline"} className={disabledReason ? "text-muted-foreground" : "text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"} aria-label={disabledReason ? `${locked ? "เหตุผลที่ล็อก" : "เหตุผลที่ลบไม่ได้"}: ${label}` : "ลบ"}>{disabledReason ? <LockKeyhole aria-hidden="true" /> : <Trash2 aria-hidden="true" />}<span className="hidden sm:inline">{locked ? "ล็อกแล้ว" : disabledReason ? "ลบไม่ได้" : "ลบ"}</span></Button></AlertDialogTrigger>
    <AlertDialogContent onEscapeKeyDown={event => { if (busy.current) event.preventDefault(); }}>
      <AlertDialogHeader><AlertDialogTitle>{disabledReason ? locked ? "รายการนี้ล็อกแล้ว" : "ยังลบรายการนี้ไม่ได้" : "ยืนยันลบรายการ?"}</AlertDialogTitle><AlertDialogDescription>{disabledReason ? <>{label}<br />{disabledReason}</> : <>ลบ {label}{kind === "round" ? " รวมรายวิชาและตารางสอบในรอบนี้ที่ยังไม่มีประวัติคำขอ" : kind === "subject" ? " และตารางสอบของวิชานี้ที่ยังไม่ถูกใช้ในคำขอ" : ""} การลบกู้คืนไม่ได้ ระบบจะไม่ลบคำขอหรือไฟล์ข้อสอบที่มีประวัติอ้างอิง</>}</AlertDialogDescription></AlertDialogHeader>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>{disabledReason ? "เข้าใจแล้ว" : "กลับไปตรวจทาน"}</AlertDialogCancel>{!disabledReason ? <AlertDialogAction disabled={pending} className="bg-destructive text-white hover:bg-destructive/90" onClick={event => { event.preventDefault(); void remove(); }}>{pending ? "กำลังลบ..." : "ยืนยันลบ"}</AlertDialogAction> : null}</AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
