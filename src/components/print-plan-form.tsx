"use client";
import { useState, type ReactNode } from "react";
import { FileUpload } from "./file-upload";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { savePrintPlanAction } from "@/actions/print-plan";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Alert, AlertDescription } from "./ui/alert";

type Room = { id: string; roomCode: string; studentCount: number; baseCopyCount: number; reserveCount: number };
export function PrintPlanForm({ requestId, rooms, files, selectedFileId, revision, confirmed, coversReady, children }: { requestId: string; rooms: Room[]; files: { id: string; originalFileName: string; kind: string; version: number }[]; selectedFileId: string | null; revision: number; confirmed: boolean; coversReady: boolean; children: ReactNode }) {
  const router = useRouter();
  const [fileId, setFileId] = useState(selectedFileId ?? files.find((file) => file.kind === "ต้นฉบับ")?.id ?? "");
  const [values, setValues] = useState(() => rooms.map((room) => ({ id: room.id, baseCopyCount: String(room.baseCopyCount), reserveCount: String(room.reserveCount) })));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(!confirmed);
  const [editing, setEditing] = useState(!confirmed);
  const [error, setError] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await savePrintPlanAction({ requestId, selectedExamFileId: fileId, revision, reason, rooms: values.map((row) => ({ id: row.id, baseCopyCount: Number(row.baseCopyCount), reserveCount: Number(row.reserveCount) })) });
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function covers() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      for (const room of rooms) {
        const response = await fetch(`/api/cover-sheets/generate/${room.id}`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `สร้างใบปะหน้าห้อง ${room.roomCode} ไม่สำเร็จ`);
      }
      toast.success("สร้างใบปะหน้าครบทุกห้องแล้ว พร้อมเริ่มพิมพ์"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "สร้างใบปะหน้าไม่สำเร็จ กรุณาลองใหม่"); router.refresh(); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <ol aria-label="ขั้นตอนเตรียมพิมพ์" className="space-y-2 border-l-2 pl-4 text-sm"><li>{confirmed ? "✓" : "1."} ยืนยันไฟล์และจำนวน</li><li>{coversReady ? "✓" : "2."} สร้างใบปะหน้าครบทุกห้อง</li><li>3. เริ่มพิมพ์</li></ol>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {editing ? <div className="space-y-5 border-t pt-5">
    <Label htmlFor="print-file">ไฟล์ที่ใช้พิมพ์</Label><Select value={fileId} disabled={busy} onValueChange={(value) => { setFileId(value); setDirty(true); }}><SelectTrigger id="print-file"><SelectValue placeholder="เลือก PDF" /></SelectTrigger><SelectContent>{files.map((file) => <SelectItem key={file.id} value={file.id}>{file.originalFileName} · {file.kind} v{file.version}</SelectItem>)}</SelectContent></Select>
    {rooms.map((room, index) => <div key={room.id} className="space-y-4 border-t py-5"><p className="font-medium">ห้อง {room.roomCode} · อาจารย์ขอ {room.studentCount} ชุด</p><div className="grid gap-3 sm:grid-cols-3">{(["baseCopyCount", "reserveCount"] as const).map((key) => <div key={key} className="space-y-2"><Label htmlFor={`${key}-${room.id}`}>{key === "baseCopyCount" ? "จำนวนพิมพ์หลัก" : "สำรอง"}</Label><Input id={`${key}-${room.id}`} type="number" min={key === "baseCopyCount" ? 1 : 0} value={values[index][key]} disabled={busy} onChange={(event) => { setValues(values.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value)); setDirty(true); }} /></div>)}<p className="self-end py-2 font-semibold">รวม {Number(values[index].baseCopyCount) + Number(values[index].reserveCount)} ชุด</p></div></div>)}
    {values.some((value,index)=>Number(value.baseCopyCount)!==rooms[index].studentCount) ? <div className="space-y-2"><Label htmlFor="print-reason">เหตุผลเมื่อปรับยอดหลักต่างจากที่อาจารย์ขอ</Label><Textarea id="print-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} /></div> : null}
    <details className="border-t pt-3"><summary className="cursor-pointer text-sm text-muted-foreground">ตัวเลือกเพิ่มเติม: อัปโหลดไฟล์พร้อมพิมพ์แทนต้นฉบับ</summary><div className="pt-4"><p className="mb-3 text-sm text-muted-foreground">ไม่จำเป็นสำหรับงานทั่วไป หลังอัปโหลดให้เลือกไฟล์ด้านบนและยืนยันใหม่</p><FileUpload requestId={requestId} kind="พร้อมพิมพ์" /></div></details>
    <Button disabled={busy} onClick={save}>ยืนยันไฟล์และจำนวนพิมพ์</Button>
    {confirmed ? <Button variant="ghost" disabled={busy} onClick={()=>{setEditing(false);setDirty(false);setFileId(selectedFileId??"");setValues(rooms.map(room=>({id:room.id,baseCopyCount:String(room.baseCopyCount),reserveCount:String(room.reserveCount)})));}}>ยกเลิกการแก้ไข</Button> : null}
    </div> : <div className="space-y-3 border-t pt-4"><p className="break-all text-sm">ไฟล์: {files.find(file=>file.id===selectedFileId)?.originalFileName}</p>{rooms.map(room=><p key={room.id} className="text-sm">ห้อง {room.roomCode} · หลัก {room.baseCopyCount} + สำรอง {room.reserveCount} = <strong>{room.baseCopyCount+room.reserveCount} ชุด</strong></p>)}<Button variant="ghost" size="sm" disabled={busy} onClick={()=>setEditing(true)}>แก้ไขไฟล์หรือจำนวน</Button></div>}
    {!editing && confirmed && !dirty ? <div className="border-t pt-4">{coversReady ? <><p className="mb-4 text-sm">ใบปะหน้าพร้อมแล้ว ขั้นต่อไปเปิด PDF และจัดซองตามห้อง</p>{children}</> : <><p className="mb-4 text-sm">ขั้นต่อไปสร้างใบปะหน้า {rooms.length} ห้องจากจำนวนที่ยืนยันแล้ว</p><Button disabled={busy} onClick={covers}>{busy ? "กำลังสร้างใบปะหน้า..." : "สร้างใบปะหน้าทุกห้อง"}</Button></>}</div> : null}
  </div>;
}
