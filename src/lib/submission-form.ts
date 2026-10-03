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
export const requestedRoomsSchema = z.array(z.object({ examRoomId: z.uuid(), count: z.number().int().min(0).max(10000) })).min(1)
  .refine((rows) => new Set(rows.map((row) => row.examRoomId)).size === rows.length, "ห้องสอบซ้ำ");

export function validateRequestedRooms(rows: z.infer<typeof requestedRoomsSchema>, schedules: { examRoomId: string; capacity: number }[], complete = false) {
  requestedRoomsSchema.parse(rows);
  if (rows.length !== schedules.length) throw new Error("กรุณาระบุจำนวนให้ครบทุกห้องของวิชา");
  for (const row of rows) {
    const schedule = schedules.find((entry) => entry.examRoomId === row.examRoomId);
    if (!schedule) throw new Error("ห้องสอบไม่อยู่ในรายวิชานี้");
    if (row.count > schedule.capacity) throw new Error("จำนวนชุดที่ขอเกินความจุห้อง กรุณาติดต่อเจ้าหน้าที่เพื่อจัดห้องเพิ่ม");
    if (complete && row.count < 1) throw new Error("กรุณากรอกจำนวนชุดข้อสอบมากกว่า 0 ให้ครบทุกห้อง");
  }
}
