import { asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelRequestDialog } from "@/components/cancel-request-dialog";
import { transitionWithFeedback } from "@/actions/workflow-feedback";
import { WorkflowForm } from "@/components/workflow-form";
import { RequestEditor, SubmissionSummary } from "@/components/request-forms";
import { PrintPlanForm } from "@/components/print-plan-form";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { coverSheets, examFiles, examRounds, examRooms, rooms, printJobs, requestRooms, requestStatusHistory, subjects, user } from "@/db/schema";
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
  const [[subjectInfo], roomRows, fileRows, coverRows, history, [job], capacities] = await Promise.all([
    db.select({ subject: subjects, round: examRounds, instructorName: user.name }).from(subjects).innerJoin(examRounds, eq(subjects.roundId, examRounds.id)).innerJoin(user, eq(subjects.instructorId, user.id)).where(eq(subjects.id, request.subjectId)).limit(1),
    db.select().from(requestRooms).where(eq(requestRooms.requestId, request.id)).orderBy(asc(requestRooms.examDate), asc(requestRooms.startsAt)),
    db.select().from(examFiles).where(eq(examFiles.requestId, request.id)).orderBy(desc(examFiles.uploadedAt)),
    db.select({ cover: coverSheets, roomId: requestRooms.id }).from(coverSheets).innerJoin(requestRooms, eq(coverSheets.requestRoomId, requestRooms.id)).where(eq(requestRooms.requestId, request.id)).orderBy(desc(coverSheets.version)),
    db.select().from(requestStatusHistory).where(eq(requestStatusHistory.requestId, request.id)).orderBy(desc(requestStatusHistory.createdAt)),
    db.select().from(printJobs).where(eq(printJobs.requestId, request.id)).limit(1),
    db.select({ examRoomId: examRooms.id, capacity: rooms.capacity }).from(examRooms).innerJoin(rooms, eq(examRooms.roomId, rooms.id)).where(eq(examRooms.subjectId, request.subjectId)),
  ]);
  if (!subjectInfo) notFound();
  const editable = canEditRequest({ role: session.user.role, userId: session.user.id, instructorId: request.instructorId, status: request.status, cancelledAt: request.cancelledAt });
  const cancelable = canCancelRequest({ role: session.user.role, userId: session.user.id, instructorId: request.instructorId, status: request.status, cancelledAt: request.cancelledAt });
  const downloadable = canDownloadExamFile({ role: session.user.role, userId: session.user.id, instructorId: request.instructorId, status: request.status, cancelledAt: request.cancelledAt });
  const latestCoverByRoom = new Map<string, (typeof coverRows)[number]["cover"]>();
  coverRows.forEach(({ roomId, cover }) => { if (!latestCoverByRoom.has(roomId)) latestCoverByRoom.set(roomId, cover); });

  const editorSubject = { id: subjectInfo.subject.id, label: `${subjectInfo.subject.courseCode} ${subjectInfo.subject.courseName} · กลุ่ม ${subjectInfo.subject.groupNo}`, semester: `ภาคการศึกษา ${subjectInfo.round.semester}/${subjectInfo.round.academicYear}`, rooms: roomRows.map((room) => ({ examRoomId: room.examRoomId, label: `${room.roomCode} ${room.roomName} · ${room.examDate} ${room.startsAt.slice(0, 5)}–${room.endsAt.slice(0, 5)}`, count: room.studentCount, capacity: capacities.find((entry) => entry.examRoomId === room.examRoomId)?.capacity ?? 0 })) };
  const nextStep = { "ฉบับร่าง": "อาจารย์กรอกแบบฟอร์ม แนบ PDF และตรวจทานก่อนส่ง", "รอตรวจสอบ": "รอหน่วยโสตเปิดข้อสอบและตรวจแบบฟอร์ม", "ปฏิเสธ/ส่งกลับแก้ไข": "อาจารย์แก้ไขตามเหตุผลแล้วส่งตรวจใหม่", "ตัดข้อสอบ": "หน่วยโสตยืนยันไฟล์และจำนวน สร้างใบปะหน้า แล้วเริ่มพิมพ์", "กำลังพิมพ์": "หน่วยโสตพิมพ์และจัดซองให้ครบ ก่อนยืนยันพิมพ์เสร็จ", "พิมพ์เสร็จแล้ว": "จัดพิมพ์และจัดซองครบแล้ว จบงานในระบบ สามารถนำซองไปส่งเจ้าหน้าที่ตามตารางสอบ", "ส่งมอบแล้ว": "งานเสร็จแล้ว (ข้อมูลจากระบบเดิม)" }[request.status];

  const av = session.user.role === ROLES.AV_UNIT && !request.cancelledAt;
  const pending = av && request.status === REQUEST_STATUSES.PENDING_REVIEW;
  const preparing = av && request.status === REQUEST_STATUSES.CUTTING;
  const printing = av && request.status === REQUEST_STATUSES.PRINTING;
  const completed = request.status === REQUEST_STATUSES.PRINTED || request.status === "ส่งมอบแล้ว";
  const original = fileRows.find((file) => file.kind === "ต้นฉบับ");
  const coversReady = !!job?.confirmedAt && roomRows.length > 0 && roomRows.every((room) => latestCoverByRoom.get(room.id)?.printRevision === job.revision);
  const total = roomRows.reduce((sum, room) => sum + room.printCount, 0);
  const transition = (toStatus: string, label: string) => <WorkflowForm action={transitionWithFeedback}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="toStatus" value={toStatus} /><SubmitButton className="w-full sm:w-auto">{label}</SubmitButton></WorkflowForm>;
  const roomSummary = <ul className="divide-y">{roomRows.map((room) => <li key={room.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p className="font-medium">{room.roomCode} {room.roomName}</p><p className="text-muted-foreground">{room.examDate} · {room.startsAt.slice(0,5)}–{room.endsAt.slice(0,5)}</p></div><p>อาจารย์ขอ {room.studentCount} · หลัก {room.baseCopyCount} + สำรอง {room.reserveCount} = <strong>{room.printCount} ชุด</strong></p></li>)}</ul>;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8" data-testid="request-workflow">
      <Link href="/dashboard/requests" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft className="size-4" /> คำขอทั้งหมด</Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{request.requestNo}</p><StatusBadge status={request.status} /></div>
        <h1 className="break-words text-2xl font-semibold sm:text-3xl">{subjectInfo.subject.courseCode} {subjectInfo.subject.courseName}</h1>
        <p className="text-sm text-muted-foreground">กลุ่ม {subjectInfo.subject.groupNo} · {subjectInfo.round.name} · {subjectInfo.instructorName}</p>
      </header>

      {request.rejectReason ? <Alert variant="destructive"><AlertTitle>สิ่งที่ต้องแก้ไข</AlertTitle><AlertDescription>{request.rejectReason}</AlertDescription></Alert> : null}
      {editable ? <Card><CardHeader><CardTitle>แก้ไขและส่งข้อสอบ</CardTitle></CardHeader><CardContent><RequestEditor subjects={[editorSubject]} existing={{ id: request.id, pageCount: request.pageCount, submissionForm: request.submissionForm }} existingFileName={original?.originalFileName} hasFile={!!original} /></CardContent></Card> : null}

      {pending ? <Card data-testid="current-task"><CardHeader><CardTitle>1. ตรวจข้อสอบก่อนรับงาน</CardTitle><CardDescription>อ่านแบบฟอร์มและเปิด PDF จากนั้นรับงาน หรือส่งกลับหากต้องแก้ไข</CardDescription></CardHeader><CardContent className="space-y-6">
        <SubmissionSummary form={request.submissionForm} />
        {original && downloadable ? <Link className="flex min-h-11 items-center gap-3 border-y py-4 font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" href={`/api/files/${original.id}/download`} target="_blank"><FileText className="size-5 shrink-0" /><span className="break-all">{original.originalFileName} · ต้นฉบับ v{original.version} ↗</span></Link> : null}
        {roomSummary}
        {transition(REQUEST_STATUSES.CUTTING, "รับงานและเตรียมพิมพ์")}
        <section className="border-t pt-5" aria-labelledby="return-request-title"><h2 id="return-request-title" className="font-semibold">ส่งกลับให้อาจารย์แก้ไข</h2><WorkflowForm action={transitionWithFeedback} className="mt-4 space-y-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="toStatus" value={REQUEST_STATUSES.RETURNED} /><Label htmlFor="reason">เหตุผลที่ส่งกลับ</Label><Textarea id="reason" name="reason" required /><SubmitButton variant="destructive" className="w-full sm:w-auto">ส่งกลับให้อาจารย์แก้ไข</SubmitButton></WorkflowForm></section>
      </CardContent></Card> : null}

      {preparing ? <Card data-testid="current-task"><CardHeader><CardTitle>2. เตรียมพิมพ์</CardTitle><CardDescription>ยืนยันไฟล์และจำนวน → สร้างใบปะหน้า → เริ่มพิมพ์</CardDescription></CardHeader><CardContent>
        <PrintPlanForm key={`${job?.revision}-${job?.confirmedAt?.toISOString()}`} requestId={request.id} rooms={roomRows.map(({id,roomCode,studentCount,baseCopyCount,reserveCount}) => ({id,roomCode,studentCount,baseCopyCount,reserveCount}))} files={fileRows.map(({ id, originalFileName, kind, version }) => ({ id, originalFileName, kind, version }))} selectedFileId={job?.selectedExamFileId ?? null} revision={job?.revision ?? 0} confirmed={!!job?.confirmedAt} coversReady={coversReady}>
          {transition(REQUEST_STATUSES.PRINTING, "เริ่มพิมพ์")}
        </PrintPlanForm>
      </CardContent></Card> : null}

      {printing ? <Card data-testid="current-task"><CardHeader><CardTitle>3. พิมพ์และจัดซองทีละห้อง</CardTitle><CardDescription>ตั้งจำนวนชุดและรูปแบบหน้าในหน้าต่างพิมพ์ด้วยตนเอง เมื่อจัดครบทุกซองแล้วจึงยืนยันด้านล่าง</CardDescription></CardHeader><CardContent className="space-y-5">
        {roomRows.map((room, index) => { const cover=latestCoverByRoom.get(room.id); return <section key={room.id} className="space-y-3 border-b pb-5"><h2 className="font-semibold">{index+1}. ห้อง {room.roomCode} · {room.printCount} ชุด</h2><p className="text-sm text-muted-foreground">หลัก {room.baseCopyCount} + สำรอง {room.reserveCount} · {room.examDate} {room.startsAt.slice(0,5)}–{room.endsAt.slice(0,5)}</p><ol className="space-y-3 text-sm">
          <li>{job?.selectedExamFileId && downloadable ? <Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" target="_blank" href={`/api/files/${job.selectedExamFileId}/download`}>พิมพ์ข้อสอบ {room.printCount} ชุด ↗</Link> : <span>งานเดิมไม่ระบุรุ่นไฟล์ กรุณาตรวจไฟล์ในเอกสารย้อนหลัง</span>}</li>
          <li>{cover ? <Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" target="_blank" href={`/api/cover-sheets/${cover.id}/download`}>พิมพ์ใบปะหน้า 1 ใบ ↗</Link> : <span>ไม่พบใบปะหน้าสำหรับงานเดิม</span>}</li>
          <li>ตรวจจำนวนแล้วใส่ซองให้ตรงกับห้อง</li>
        </ol></section>; })}
        {transition(REQUEST_STATUSES.PRINTED, "ยืนยันพิมพ์เสร็จ")}
      </CardContent></Card> : null}

      {!editable && !pending && !preparing && !printing ? <Card data-testid="current-task"><CardHeader><CardTitle>{request.cancelledAt ? "ยกเลิกคำขอแล้ว" : completed ? "พิมพ์เสร็จแล้ว · จบงานในระบบ" : "ความคืบหน้าคำขอ"}</CardTitle><CardDescription>{request.cancelledAt ? "ข้อมูลและไฟล์เดิมยังอยู่ในประวัติ" : nextStep}</CardDescription></CardHeader><CardContent>{completed && !request.cancelledAt ? <p className="mb-3 font-medium">{roomRows.length} ซอง รวม {total} ชุด</p> : null}{roomSummary}</CardContent></Card> : null}

      {cancelable ? <section aria-label="การยกเลิกคำขอ" className="space-y-3 border-t pt-5"><p className="text-sm text-muted-foreground">ยกเลิกได้ก่อนหน่วยโสตรับงาน ไฟล์และประวัติเดิมยังคงอยู่</p><CancelRequestDialog requestId={request.id} /></section> : null}

      <section aria-label="ข้อมูลประกอบและประวัติ" className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">ข้อมูลประกอบและประวัติ</h2>
        {!pending && !editable ? <details className="border-t"><summary className="font-medium">แบบฟอร์มที่อาจารย์ส่ง · {request.pageCount} หน้า</summary><div className="pb-6 pt-3"><SubmissionSummary form={request.submissionForm} />{request.printDetail ? <p className="mt-4 whitespace-pre-wrap text-sm">{request.printDetail}</p> : null}</div></details> : null}
        <details className="border-t"><summary className="font-medium">เอกสารและไฟล์ย้อนหลัง · {fileRows.length} ไฟล์</summary><div className="space-y-4 pb-6 pt-3">
          {fileRows.map((file) => <div key={file.id} className="border-b pb-3 text-sm">{downloadable ? <Link className="break-all text-primary underline underline-offset-4" target="_blank" href={`/api/files/${file.id}/download`}>{file.originalFileName} ↗</Link> : <p className="break-all">{file.originalFileName} · ไม่มีสิทธิ์เปิดข้อสอบ</p>}<p className="text-muted-foreground">{file.kind} · v{file.version} · {(file.sizeBytes/1024/1024).toFixed(2)} MB</p></div>)}
          {coverRows.map(({cover,roomId}) => <Link key={cover.id} className="block text-sm text-primary underline underline-offset-4" target="_blank" href={`/api/cover-sheets/${cover.id}/download`}>ใบปะหน้า {roomRows.find(room=>room.id===roomId)?.roomCode} · v{cover.version}{cover.printRevision !== job?.revision ? " (รุ่นเก่า)" : ""} ↗</Link>)}
          {!fileRows.length ? <p className="text-sm text-muted-foreground">ยังไม่มีไฟล์</p> : null}
        </div></details>
        <details className="border-t"><summary className="font-medium">ประวัติสถานะ · {history.length} รายการ</summary><ol className="space-y-5 pb-6 pt-3">{history.map(item=><li key={item.id} className="border-l-2 pl-4 text-sm"><p className="font-medium">{item.toStatus}</p><p className="text-muted-foreground">{item.actorUsernameSnapshot} · {item.createdAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</p>{item.reason ? <p>{item.reason}</p>:null}</li>)}</ol></details>
      </section>
    </div>
  );
}
