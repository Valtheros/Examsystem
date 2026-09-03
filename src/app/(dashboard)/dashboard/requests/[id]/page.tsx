import { and, asc, desc, eq } from "drizzle-orm";
import { Download, FileCheck2, FileText, LockKeyhole, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelRequestAction, deliverRequestAction, transitionRequestAction } from "@/actions/requests";
import { CoverSheetButton } from "@/components/cover-sheet-button";
import { FileUpload } from "@/components/file-upload";
import { EditRequestForm } from "@/components/request-forms";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { coverSheets, examFiles, examRounds, requestRooms, requestStatusHistory, subjects, user } from "@/db/schema";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { canCancelRequest, canDownloadExamFile, canEditRequest } from "@/lib/permissions";
import { getAuthorizedRequest } from "@/lib/request-access";
import { requirePageSession } from "@/lib/session";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageSession();
  const { id } = await params;
  let request;
  try {
    request = await getAuthorizedRequest(id, session);
  } catch {
    notFound();
  }
  const [[subjectInfo], roomRows, fileRows, coverRows, history, officers] = await Promise.all([
    db.select({ subject: subjects, round: examRounds, instructorName: user.name }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).innerJoin(user, eq(subjects.instructorId, user.id)).where(eq(subjects.id, request.subjectId)).limit(1),
    db.select().from(requestRooms).where(eq(requestRooms.requestId, request.id)).orderBy(asc(requestRooms.examDate), asc(requestRooms.startsAt)),
    db.select().from(examFiles).where(eq(examFiles.requestId, request.id)).orderBy(desc(examFiles.uploadedAt)),
    db.select({ cover: coverSheets, roomId: requestRooms.id }).from(coverSheets).innerJoin(requestRooms, eq(coverSheets.requestRoomId, requestRooms.id)).where(eq(requestRooms.requestId, request.id)).orderBy(desc(coverSheets.version)),
    db.select().from(requestStatusHistory).where(eq(requestStatusHistory.requestId, request.id)).orderBy(desc(requestStatusHistory.createdAt)),
    db.select({ id: user.id, name: user.name }).from(user).where(and(eq(user.role, ROLES.OFFICER), eq(user.banned, false))).orderBy(asc(user.name)),
  ]);
  if (!subjectInfo) notFound();
  const editable = canEditRequest({ role: session.user.role, userId: session.user.id, instructorId: request.instructorId, status: request.status, cancelledAt: request.cancelledAt });
  const cancelable = canCancelRequest({ role: session.user.role, userId: session.user.id, instructorId: request.instructorId, status: request.status, cancelledAt: request.cancelledAt });
  const downloadable = canDownloadExamFile({ role: session.user.role, userId: session.user.id, instructorId: request.instructorId, status: request.status, cancelledAt: request.cancelledAt });
  const latestCoverByRoom = new Map<string, (typeof coverRows)[number]["cover"]>();
  coverRows.forEach(({ roomId, cover }) => { if (!latestCoverByRoom.has(roomId)) latestCoverByRoom.set(roomId, cover); });

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><p className="text-sm font-medium text-primary">{request.requestNo}</p><h1 className="text-3xl font-semibold">{subjectInfo.subject.courseCode} {subjectInfo.subject.courseName}</h1><p className="mt-2 text-muted-foreground">กลุ่ม {subjectInfo.subject.groupNo} · {subjectInfo.round.name} · ผู้ส่ง {subjectInfo.instructorName}</p></div>
        <StatusBadge status={request.status} />
      </div>
      {request.rejectReason ? <Alert variant="destructive"><AlertTitle>ส่งกลับแก้ไข</AlertTitle><AlertDescription>{request.rejectReason}</AlertDescription></Alert> : null}
      {request.lockedAt ? <Alert><LockKeyhole className="size-4" /><AlertTitle>คำขอถูกล็อกแล้ว</AlertTitle><AlertDescription>เมื่อเข้าสู่สถานะตัดข้อสอบ อาจารย์แก้ไข ลบ หรือยกเลิกคำขอไม่ได้</AlertDescription></Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>แบบฟอร์มส่งข้อสอบ</CardTitle><CardDescription>ต้นฉบับกระดาษ {request.originalCopyCount} ชุด · ข้อสอบ {request.pageCount} หน้า</CardDescription></CardHeader><CardContent>{editable ? <EditRequestForm request={request} /> : <div className="rounded-xl bg-muted/40 p-4 whitespace-pre-wrap">{request.printDetail || "ไม่มีรายละเอียดเพิ่มเติม"}</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle>ไฟล์ข้อสอบ</CardTitle><CardDescription>เปลี่ยนไฟล์ด้วยการสร้าง version ใหม่ ระบบไม่เขียนทับไฟล์เดิม</CardDescription></CardHeader><CardContent className="space-y-5">
            {editable ? <FileUpload requestId={request.id} kind="ต้นฉบับ" /> : null}
            {session.user.role === ROLES.AV_UNIT && [REQUEST_STATUSES.CUTTING, REQUEST_STATUSES.PRINTING].includes(request.status as typeof REQUEST_STATUSES.CUTTING) ? <FileUpload requestId={request.id} kind="พร้อมพิมพ์" /> : null}
            <Separator />
            <div className="space-y-2">{fileRows.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium"><FileText className="mr-2 inline size-4" />{file.originalFileName}</p><p className="text-xs text-muted-foreground">{file.kind} · v{file.version} · {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB · SHA {file.sha256.slice(0, 10)}…</p></div>{downloadable ? <Button asChild size="sm" variant="outline"><Link href={`/api/files/${file.id}/download`}><Download className="size-4" /> ดาวน์โหลด</Link></Button> : <Badge variant="secondary">ไม่มีสิทธิ์ดาวน์โหลด</Badge>}</div>)}{!fileRows.length ? <p className="py-6 text-center text-muted-foreground">ยังไม่มีไฟล์</p> : null}</div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>รายละเอียดแยกตามห้อง</CardTitle><CardDescription>RequestRoom เก็บ snapshot จากตารางสอบเพื่อให้ใบปะหน้าไม่เปลี่ยนตามข้อมูลต้นทางภายหลัง</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{roomRows.map((room) => { const cover = latestCoverByRoom.get(room.id); return <div key={room.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{room.roomCode} {room.roomName}</p><p className="text-sm text-muted-foreground">{room.examDate} · {room.startsAt.slice(0, 5)}–{room.endsAt.slice(0, 5)}</p></div><Badge variant="outline">{room.printCount} ชุด</Badge></div><p className="mt-3 text-sm">ผู้เข้าสอบ {room.studentCount} + สำรอง {room.reserveCount}</p><div className="mt-4 flex flex-wrap gap-2">{session.user.role === ROLES.AV_UNIT && [REQUEST_STATUSES.CUTTING, REQUEST_STATUSES.PRINTING, REQUEST_STATUSES.PRINTED].includes(request.status as typeof REQUEST_STATUSES.CUTTING) ? <CoverSheetButton requestRoomId={room.id} /> : null}{cover ? <Button asChild size="sm" variant="outline"><Link href={`/api/cover-sheets/${cover.id}/download`}><Download className="size-4" /> ใบปะหน้า v{cover.version}</Link></Button> : null}</div></div>; })}</CardContent></Card>
        </div>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle>ดำเนินการ</CardTitle><CardDescription>ระบบตรวจสถานะต้นทางและสิทธิ์ซ้ำที่ฝั่ง server ทุกครั้ง</CardDescription></CardHeader><CardContent className="space-y-4">
            {session.user.role === ROLES.INSTRUCTOR && [REQUEST_STATUSES.DRAFT, REQUEST_STATUSES.RETURNED].includes(request.status as typeof REQUEST_STATUSES.DRAFT) ? <>
              <form action={transitionRequestAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="toStatus" value={REQUEST_STATUSES.PENDING_REVIEW} /><SubmitButton className="w-full"><Send className="size-4" /> ส่งคำขอตรวจสอบ</SubmitButton></form>
            </> : null}
            {cancelable ? <form action={cancelRequestAction} className="space-y-2"><input type="hidden" name="requestId" value={request.id} /><Label htmlFor="cancelReason">เหตุผลการยกเลิก (ถ้ามี)</Label><Textarea id="cancelReason" name="reason" /><SubmitButton className="w-full" variant="destructive"><Trash2 className="size-4" /> ยกเลิกคำขอ</SubmitButton></form> : null}
            {session.user.role === ROLES.AV_UNIT && request.status === REQUEST_STATUSES.PENDING_REVIEW ? <>
              <form action={transitionRequestAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="toStatus" value={REQUEST_STATUSES.CUTTING} /><SubmitButton className="w-full"><FileCheck2 className="size-4" /> รับตัดข้อสอบ</SubmitButton></form>
              <form action={transitionRequestAction} className="space-y-2"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="toStatus" value={REQUEST_STATUSES.RETURNED} /><Label htmlFor="reason">เหตุผลที่ส่งกลับ</Label><Textarea id="reason" name="reason" required /><SubmitButton className="w-full" variant="destructive">ส่งกลับให้อาจารย์แก้ไข</SubmitButton></form>
            </> : null}
            {session.user.role === ROLES.AV_UNIT && request.status === REQUEST_STATUSES.CUTTING ? <form action={transitionRequestAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="toStatus" value={REQUEST_STATUSES.PRINTING} /><SubmitButton className="w-full">เริ่มพิมพ์</SubmitButton></form> : null}
            {session.user.role === ROLES.AV_UNIT && request.status === REQUEST_STATUSES.PRINTING ? <form action={transitionRequestAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="toStatus" value={REQUEST_STATUSES.PRINTED} /><SubmitButton className="w-full">ยืนยันพิมพ์เสร็จ</SubmitButton></form> : null}
            {session.user.role === ROLES.AV_UNIT && request.status === REQUEST_STATUSES.PRINTED ? <form action={deliverRequestAction} className="space-y-3"><input type="hidden" name="requestId" value={request.id} /><Label htmlFor="receiverId">เจ้าหน้าที่ผู้รับมอบ</Label><Select name="receiverId" required><SelectTrigger id="receiverId"><SelectValue placeholder="เลือกผู้รับมอบ" /></SelectTrigger><SelectContent>{officers.map((officer) => <SelectItem key={officer.id} value={officer.id}>{officer.name}</SelectItem>)}</SelectContent></Select><Label htmlFor="deliveryNote">หมายเหตุ</Label><Textarea id="deliveryNote" name="note" /><SubmitButton className="w-full">ยืนยันส่งมอบ</SubmitButton></form> : null}
            {request.status === REQUEST_STATUSES.DELIVERED ? <Alert><FileCheck2 className="size-4" /><AlertDescription>ส่งมอบให้เจ้าหน้าที่แล้ว ขั้นต่อไปเจ้าหน้าที่สแกน QR บนใบปะหน้าเมื่อแจกเข้าห้องสอบ</AlertDescription></Alert> : null}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>ประวัติสถานะ</CardTitle></CardHeader><CardContent className="space-y-4">{history.map((item, index) => <div key={item.id} className="relative pl-6 before:absolute before:left-1.5 before:top-2 before:size-2 before:rounded-full before:bg-primary"><p className="font-medium">{item.toStatus}</p><p className="text-xs text-muted-foreground">{item.actorUsernameSnapshot} · {item.createdAt.toLocaleString("th-TH")}</p>{item.reason ? <p className="mt-1 text-sm">{item.reason}</p> : null}{index < history.length - 1 ? <span className="absolute left-[9px] top-5 h-full w-px bg-border" /> : null}</div>)}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
