"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSubmissionAction } from "@/actions/submission";
import { transitionWithFeedback } from "@/actions/workflow-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emptySubmissionForm, MATERIALS, requestedCountError, submissionFormSchema, validateRequestedRooms, type DraftSubmissionForm } from "@/lib/submission-form";
import { getErrorMessage } from "@/lib/errors";
import { uploadExamFile } from "@/lib/upload-exam-client";

export type RequestSubjectOption = { id: string; label: string; semester: string; rooms: { examRoomId: string; label: string; capacity: number; count?: number }[] };
type Existing = { id: string; pageCount: number; submissionForm: DraftSubmissionForm | null };
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function RequestEditor({ subjects, existing, hasFile = false, existingFileName = "" }: { subjects: RequestSubjectOption[]; existing?: Existing; hasFile?: boolean; existingFileName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(existing ? 2 : 1);
  const [subjectId, setSubjectId] = useState(existing ? subjects[0]?.id ?? "" : "");
  const [requestId, setRequestId] = useState(existing?.id);
  const [form, setForm] = useState<DraftSubmissionForm>(existing?.submissionForm ?? emptySubmissionForm);
  const [pageCount, setPageCount] = useState(String(existing?.pageCount ?? 1));
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(subjects.flatMap((subject) => subject.rooms.map((room) => [room.examRoomId, room.count ? String(room.count) : ""]))));
  const [file, setFile] = useState<File>();
  const [uploaded, setUploaded] = useState(hasFile);
  const [uploadedName, setUploadedName] = useState(existingFileName);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const stepStart = useRef<HTMLDivElement>(null);
  function goToStep(next: number) {
    setStep(next);
    requestAnimationFrame(() => {
      stepStart.current?.scrollIntoView({ block: "start" });
      stepStart.current?.focus({ preventScroll: true });
    });
  }
  const subject = subjects.find((entry) => entry.id === subjectId);
  const set = (key: keyof DraftSubmissionForm, value: string | string[]) => setForm((previous) => ({ ...previous, [key]: value }));
  async function save(review = false) {
    if (busy || !subject) return;
    setError(""); setErrors({}); setBusy(true);
    try {
      const roomCounts = subject.rooms.map((room) => ({ examRoomId: room.examRoomId, count: Number(counts[room.examRoomId] || 0) }));
      const quantityErrors = Object.fromEntries(subject.rooms.map(room => [`copies-${room.examRoomId}`, requestedCountError(Number(counts[room.examRoomId] || 0), room.capacity, review)]).filter(([, message]) => message));
      if (!Number.isInteger(Number(pageCount)) || Number(pageCount) < 1 || Number(pageCount) > 1000) quantityErrors.pageCount = "กรุณากรอกจำนวนหน้าข้อสอบเป็นจำนวนเต็มตั้งแต่ 1 ถึง 1,000 หน้า";
      if (Object.keys(quantityErrors).length) { setErrors(quantityErrors); throw new Error("กรุณาแก้ไขจำนวนในช่องที่มีข้อความเตือนด้านล่าง"); }
      validateRequestedRooms(roomCounts, subject.rooms, review);
      if (review) {
        const validated = submissionFormSchema.safeParse(form);
        if (!validated.success) { setErrors(Object.fromEntries(validated.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); throw new Error("กรุณาตรวจช่องที่ยังกรอกไม่ครบ"); }
        if (!file && !uploaded) throw new Error("กรุณาแนบ PDF ก่อนส่งตรวจ");
      }
      const result = await saveSubmissionAction({ requestId, subjectId, pageCount: Number(pageCount), submissionForm: form, roomCounts });
      if (!result.ok || !result.requestId) throw new Error(result.message);
      setRequestId(result.requestId);
      if (file) { await uploadExamFile(result.requestId, file, "ต้นฉบับ", setProgress); setUploadedName(file.name); setUploaded(true); setFile(undefined); }
      toast.success(review ? "ข้อมูลพร้อมตรวจทาน" : "บันทึกร่างแล้ว กลับมาแก้ต่อได้จากคำขอของคุณ");
      if (review) goToStep(3);
    } catch (cause) { setError(getErrorMessage(cause, "บันทึกไม่สำเร็จ กรุณาลองใหม่ ข้อมูลที่กรอกยังอยู่")); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (busy || !requestId) return;
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.set("requestId", requestId); data.set("toStatus", "รอตรวจสอบ");
      const result = await transitionWithFeedback({ ok: false, message: "" }, data);
      if (!result.ok) throw new Error(result.message);
      toast.success("ส่งข้อสอบให้หน่วยโสตตรวจแล้ว"); router.push(`/dashboard/requests/${requestId}`); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause, "ส่งข้อสอบไม่สำเร็จ กรุณาลองใหม่")); }
    finally { setBusy(false); }
  }
  function choice(key: keyof DraftSubmissionForm, title: string, options: readonly string[]) {
    return <div className="min-w-0 space-y-2"><Label htmlFor={`submission-${key}`}>{title}</Label><Select value={String(form[key])} onValueChange={(value) => set(key, value)} disabled={busy}><SelectTrigger id={`submission-${key}`}><SelectValue placeholder="กรุณาเลือก" /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>{errors[key] ? <p className="text-sm text-destructive">{errors[key]}</p> : null}</div>;
  }
  function field(key: keyof DraftSubmissionForm, title: string, maxLength: number) {
    return <div className="space-y-2"><Label htmlFor={`submission-${key}`}>{title}</Label><Input id={`submission-${key}`} value={String(form[key])} maxLength={maxLength} disabled={busy} onChange={(event) => set(key, event.target.value)} />{errors[key] ? <p className="text-sm text-destructive">{errors[key]}</p> : null}</div>;
  }
  return <div ref={stepStart} tabIndex={-1} className="space-y-6 outline-none">
    <ol aria-label="ขั้นตอนส่งข้อสอบ" className="grid grid-cols-3 gap-3 text-sm">{["เลือกรายวิชา", "แบบฟอร์มและไฟล์", "ตรวจทานและส่ง"].map((title, index) => <li key={title} aria-current={step === index + 1 ? "step" : undefined} className={`border-b-2 pb-3 leading-6 ${step === index + 1 ? "border-primary font-semibold text-primary" : "border-border text-muted-foreground"}`}>{index + 1}. {title}</li>)}</ol>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {step === 1 ? <div className="space-y-4"><Label htmlFor="request-subject">รายวิชาของคุณ</Label><Select value={subjectId} onValueChange={setSubjectId} disabled={!!requestId}><SelectTrigger id="request-subject"><SelectValue placeholder="เลือกรายวิชา" /></SelectTrigger><SelectContent>{subjects.map((row) => <SelectItem key={row.id} value={row.id}>{row.label}</SelectItem>)}</SelectContent></Select>{subject ? <p className="text-sm">{subject.semester} · จัดไว้ {subject.rooms.length} ห้อง</p> : null}<Button type="button" disabled={!subject?.rooms.length} onClick={() => goToStep(2)}>ถัดไป: กรอกแบบฟอร์ม</Button>{subject && !subject.rooms.length ? <p className="text-sm text-destructive">วิชายังไม่มีตารางสอบ กรุณาติดต่อเจ้าหน้าที่</p> : null}</div> : null}
    {step === 2 && subject ? <div className="space-y-6">
      <div className="border-l-2 border-primary pl-4"><p className="font-medium">{subject.label}</p><p className="text-sm">{subject.semester} · วัน เวลา และห้องกำหนดโดยเจ้าหน้าที่</p></div>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {field("department", "สาขาวิชา", 120)}{choice("language", "ภาษาข้อสอบ", ["ไทย", "อังกฤษ", "ไทยและอังกฤษ"])}
        <div className="space-y-2"><Label htmlFor="submission-pages">จำนวนหน้าข้อสอบ</Label><Input id="submission-pages" type="number" min={1} max={1000} value={pageCount} aria-invalid={!!errors.pageCount} aria-describedby={errors.pageCount ? "pages-error" : undefined} disabled={busy} onChange={(event) => { setPageCount(event.target.value); setErrors(previous => ({ ...previous, pageCount: "" })); }} />{errors.pageCount ? <p id="pages-error" role="alert" className="text-sm text-destructive">{errors.pageCount}</p> : null}</div>
        {choice("printLayout", "รูปแบบพิมพ์", ["หน้าเดียว", "สองหน้า", "Booklet", "อื่น ๆ"])}
        {form.printLayout === "อื่น ๆ" ? field("otherPrintLayout", "ระบุรูปแบบพิมพ์อื่น ๆ", 200) : null}
        {choice("computerAnswerSheet", "กระดาษคำตอบคอมพิวเตอร์", ["ต้องการ", "ไม่ต้องการ"])}
        {choice("scheduleType", "ประเภทการสอบ", ["ในตาราง", "นอกตาราง"])}
        {field("coordinatorPhone", "เบอร์ผู้ประสานงาน", 60)}
      </div>
      <fieldset className="space-y-3"><legend className="mb-3 font-medium">อุปกรณ์และคำแนะนำผู้คุมสอบ</legend>{MATERIALS.map((material) => <div key={material} className="flex min-h-11 items-center gap-3"><Checkbox id={`material-${material}`} disabled={busy} checked={form.materials.includes(material)} onCheckedChange={(checked) => set("materials", checked ? material === "ไม่มี" ? [material] : [...form.materials.filter((value) => value !== "ไม่มี"), material] : form.materials.filter((value) => value !== material))} /><Label htmlFor={`material-${material}`}>{material}</Label></div>)}{errors.materials ? <p className="text-sm text-destructive">{errors.materials}</p> : null}{form.materials.includes("อื่น ๆ") ? field("otherMaterials", "ระบุอุปกรณ์หรือคำแนะนำอื่น ๆ", 300) : null}</fieldset>
      <div className="space-y-2"><Label htmlFor="submission-instructions">คำอธิบายเพิ่มเติมผู้ส่งข้อสอบ</Label><Textarea id="submission-instructions" maxLength={600} value={form.instructions} disabled={busy} onChange={(event) => set("instructions", event.target.value)} /></div>
      <div className="space-y-3"><h3 className="font-semibold">จำนวนชุดข้อสอบแยกตามห้อง</h3><p className="text-sm text-muted-foreground">กรอกจำนวนผู้สอบเป็นจำนวนชุดที่ขอ ไม่รวมสำรอง หน่วยโสตจะเพิ่มสำรองให้ภายหลัง</p>{subject.rooms.map((room) => <div className="grid items-center gap-4 border-t py-5 sm:grid-cols-[1fr_240px]" key={room.examRoomId}><div className="text-sm">{room.label}<p className="text-muted-foreground">ความจุ {room.capacity} คน</p></div><div className="space-y-2"><Label htmlFor={`copies-${room.examRoomId}`}>จำนวนชุดข้อสอบที่ขอ</Label><Input id={`copies-${room.examRoomId}`} type="number" min={1} max={room.capacity} step={1} value={counts[room.examRoomId] ?? ""} aria-invalid={!!errors[`copies-${room.examRoomId}`]} aria-describedby={errors[`copies-${room.examRoomId}`] ? `copies-error-${room.examRoomId}` : undefined} disabled={busy} onChange={(event) => { const value = event.target.value; setCounts(previous => ({ ...previous, [room.examRoomId]: value })); setErrors(previous => ({ ...previous, [`copies-${room.examRoomId}`]: value ? requestedCountError(Number(value), room.capacity, true) : "" })); setError(""); }} />{errors[`copies-${room.examRoomId}`] ? <p id={`copies-error-${room.examRoomId}`} role="alert" className="text-sm text-destructive">{errors[`copies-${room.examRoomId}`]}</p> : null}</div></div>)}</div>
      <div className="space-y-2"><Label htmlFor="submission-file">ไฟล์ข้อสอบ PDF (สูงสุด 100 MB)</Label><Input id="submission-file" type="file" accept="application/pdf,.pdf" disabled={busy || !ready} onChange={(event) => { setFile(event.target.files?.[0]); setProgress(0); }} />{file ? <p className="break-all text-sm text-primary" role="status">ไฟล์ที่เลือก: {file.name}</p> : null}{uploaded ? <p className="text-sm text-primary">มีไฟล์แนบที่บันทึกแล้ว เลือกไฟล์ใหม่เฉพาะเมื่อต้องการเปลี่ยน</p> : null}{busy ? <p role="status" className="text-sm">กำลังบันทึก/อัปโหลด {progress}%</p> : null}</div>
      <div className="flex flex-wrap gap-3">{!requestId ? <Button type="button" variant="ghost" disabled={busy} onClick={() => goToStep(1)}>ย้อนกลับ</Button> : null}<Button type="button" variant="outline" disabled={busy} onClick={() => save(false)}>บันทึกฉบับร่าง</Button><Button type="button" disabled={busy} onClick={() => save(true)}>ถัดไป: ตรวจทาน</Button></div>
    </div> : null}
    {step === 3 && subject ? <div className="space-y-4"><h3 className="text-lg font-semibold">{subject.label}</h3><SubmissionSummary form={form} /><p className="break-all">ข้อสอบ {pageCount} หน้า · ไฟล์: {uploadedName}</p>{subject.rooms.map((room) => <p key={room.examRoomId} className="border-t py-4">{room.label} - ขอ {counts[room.examRoomId]} ชุด (ยังไม่รวมสำรอง)</p>)}<div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={() => goToStep(2)}>กลับไปแก้ไข</Button><Button disabled={busy} onClick={submit}>{busy ? "กำลังส่ง..." : "ยืนยันส่งข้อสอบให้หน่วยโสต"}</Button></div></div> : null}
  </div>;
}
export function SubmissionSummary({ form }: { form: DraftSubmissionForm | null }) {
  if (!form) return <p className="text-sm text-muted-foreground">ไม่ได้ระบุในระบบเดิม</p>;
  const rows = [["สาขาวิชา", form.department], ["ภาษาข้อสอบ", form.language], ["รูปแบบพิมพ์", `${form.printLayout} ${form.otherPrintLayout}`], ["อุปกรณ์/คำแนะนำ", [...form.materials, form.otherMaterials].filter(Boolean).join(" · ")], ["กระดาษคำตอบคอมพิวเตอร์", form.computerAnswerSheet], ["ประเภทการสอบ", form.scheduleType], ["เบอร์ผู้ประสานงาน", form.coordinatorPhone], ["คำอธิบายเพิ่มเติม", form.instructions]];
  return <dl className="grid gap-x-8 gap-y-5 text-base sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="mb-1 text-sm text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{value || "ไม่ได้ระบุ"}</dd></div>)}</dl>;
}
