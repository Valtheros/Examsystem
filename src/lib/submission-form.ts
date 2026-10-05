import { z } from "zod";

export const MATERIALS = ["นำตำราเข้าห้องสอบได้", "นำเครื่องคิดเลขเข้าห้องสอบได้", "ห้ามนำไม้บรรทัดมีสูตรเข้าห้องสอบ", "ไม่มี", "อื่น ๆ"] as const;
export const submissionFormSchema = z.object({
  department: z.string().trim().min(1, "กรุณาระบุสาขาวิชา").max(120),
  language: z.enum(["ไทย", "อังกฤษ", "ไทยและอังกฤษ"]),
  printLayout: z.enum(["หน้าเดียว", "สองหน้า", "Booklet", "อื่น ๆ"]),
  otherPrintLayout: z.string().trim().max(200),
  materials: z.array(z.enum(MATERIALS)).min(1, "กรุณาระบุอุปกรณ์หรือเลือก ไม่มี"),
  otherMaterials: z.string().trim().max(300),
  computerAnswerSheet: z.enum(["ต้องการ", "ไม่ต้องการ"]),
  instructions: z.string().trim().max(600),
  scheduleType: z.enum(["ในตาราง", "นอกตาราง"]),
  coordinatorPhone: z.string().trim().min(3, "กรุณาระบุเบอร์ผู้ประสานงาน").max(60),
}).superRefine((form, ctx) => {
  if (form.materials.includes("ไม่มี") && form.materials.length > 1) ctx.addIssue({ code: "custom", path: ["materials"], message: "ไม่มี ใช้ร่วมกับอุปกรณ์ข้ออื่นไม่ได้" });
  if (form.printLayout === "อื่น ๆ" && !form.otherPrintLayout) ctx.addIssue({ code: "custom", path: ["otherPrintLayout"], message: "กรุณาระบุรูปแบบพิมพ์อื่น ๆ" });
  if (form.materials.includes("อื่น ๆ") && !form.otherMaterials) ctx.addIssue({ code: "custom", path: ["otherMaterials"], message: "กรุณาระบุอุปกรณ์อื่น ๆ" });
});
export type SubmissionForm = z.infer<typeof submissionFormSchema>;
// Drafts retain incomplete answers; completeness is checked again on submission.
export const draftSubmissionFormSchema = z.object({
  department: z.string().max(120), language: z.string().max(30),
  printLayout: z.string().max(30), otherPrintLayout: z.string().max(200),
  materials: z.array(z.string().max(80)).max(5), otherMaterials: z.string().max(300),
  computerAnswerSheet: z.string().max(30), instructions: z.string().max(600),
  scheduleType: z.string().max(30), coordinatorPhone: z.string().max(60),
});
export type DraftSubmissionForm = z.infer<typeof draftSubmissionFormSchema>;
export const emptySubmissionForm: DraftSubmissionForm = {
  department: "", language: "", printLayout: "", otherPrintLayout: "", materials: [], otherMaterials: "",
  computerAnswerSheet: "", instructions: "", scheduleType: "", coordinatorPhone: "",
};
const copyCountSchema = z.number({ error: "กรุณากรอกจำนวนชุดข้อสอบเป็นตัวเลข" }).int("กรุณากรอกจำนวนชุดข้อสอบเป็นจำนวนเต็ม").min(0, "จำนวนชุดข้อสอบต้องไม่ติดลบ").max(10000, "จำนวนชุดข้อสอบต้องไม่เกิน 10,000 ชุดต่อห้อง");
export const requestedRoomsSchema = z.array(z.object({ examRoomId: z.uuid(), count: copyCountSchema })).min(1, "รายวิชานี้ยังไม่มีห้องสอบ กรุณาติดต่อเจ้าหน้าที่")
  .refine((rows) => new Set(rows.map((row) => row.examRoomId)).size === rows.length, "ห้องสอบซ้ำ");

export function requestedCountError(count: number, capacity: number, complete = false) {
  if (Number.isFinite(count) && count > capacity) return `ห้องนี้รองรับ ${capacity.toLocaleString("th-TH")} คน กรุณาขอไม่เกิน ${capacity.toLocaleString("th-TH")} ชุด หากต้องการเพิ่มห้องให้ติดต่อเจ้าหน้าที่`;
  const parsed = copyCountSchema.safeParse(count);
  if (!parsed.success) return parsed.error.issues[0].message;
  return complete && count < 1 ? "กรุณากรอกจำนวนชุดข้อสอบอย่างน้อย 1 ชุด" : "";
}

export function validateRequestedRooms(rows: z.infer<typeof requestedRoomsSchema>, schedules: { examRoomId: string; capacity: number }[], complete = false) {
  const parsed = requestedRoomsSchema.safeParse(rows);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "กรุณาตรวจสอบจำนวนชุดข้อสอบ");
  if (rows.length !== schedules.length) throw new Error("กรุณาระบุจำนวนให้ครบทุกห้องของวิชา");
  for (const row of rows) {
    const schedule = schedules.find((entry) => entry.examRoomId === row.examRoomId);
    if (!schedule) throw new Error("ห้องสอบไม่อยู่ในรายวิชานี้");
    const error = requestedCountError(row.count, schedule.capacity, complete);
    if (error) throw new Error(error);
  }
}
