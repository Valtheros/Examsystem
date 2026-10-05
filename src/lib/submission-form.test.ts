import { describe, expect, it } from "vitest";
import { emptySubmissionForm, requestedCountError, submissionFormSchema, validateRequestedRooms } from "./submission-form";
import { calculatePrintCount } from "./printing";
import { canDownloadExamFile, canUploadExamFile } from "./permissions";

const id = "00000000-0000-4000-8000-000000000001";
describe("submission and printing rules", () => {
  it("keeps teacher quantity separate from AV base and reserves", () => {
    const requested = 50;
    expect(calculatePrintCount(requested)).toBe(51);
    expect(calculatePrintCount(requested, 0)).toBe(50);
    expect(calculatePrintCount(52, 2)).toBe(54);
    expect(requested).toBe(50);
    expect(() => calculatePrintCount(50, -1)).toThrow();
    expect(() => calculatePrintCount(50, 1.5)).toThrow();
  });
  it("checks room ownership, capacity, duplicates and missing quantities", () => {
    const schedules = [{ examRoomId: id, capacity: 50 }];
    expect(() => validateRequestedRooms([{ examRoomId: id, count: 50 }], schedules, true)).not.toThrow();
    for (const count of [51, 0, -1, 1.5]) expect(() => validateRequestedRooms([{ examRoomId: id, count }], schedules, true)).toThrow();
    expect(() => validateRequestedRooms([], schedules, true)).toThrow();
    expect(() => validateRequestedRooms([{ examRoomId: id, count: 1 }], [], true)).toThrow();
    expect(() => validateRequestedRooms([{ examRoomId: id, count: 1 }, { examRoomId: id, count: 2 }], schedules, true)).toThrow();
  });
  it("requires explicit form answers and exclusive None", () => {
    expect(submissionFormSchema.safeParse(emptySubmissionForm).success).toBe(false);
    const form = { ...emptySubmissionForm, department: "วิทยาการคอมพิวเตอร์", language: "ไทย", printLayout: "หน้าเดียว", materials: ["ไม่มี"], computerAnswerSheet: "ไม่ต้องการ", scheduleType: "ในตาราง", coordinatorPhone: "0812345678" };
    expect(submissionFormSchema.safeParse(form).success).toBe(true);
    expect(submissionFormSchema.safeParse({ ...form, materials: ["ไม่มี", "นำตำราเข้าห้องสอบได้"] }).success).toBe(false);
    expect(submissionFormSchema.safeParse({ ...form, printLayout: "อื่น ๆ" }).success).toBe(false);
  });
  it("AV can review pending files but cannot upload after printing starts", () => {
    const context = { role: "หน่วยโสต" as const, userId: "av", instructorId: "teacher", status: "รอตรวจสอบ" as const };
    expect(canDownloadExamFile(context)).toBe(true);
    expect(canDownloadExamFile({ ...context, role: "เจ้าหน้าที่" })).toBe(false);
    expect(canUploadExamFile({ ...context, status: "กำลังพิมพ์" }, "พร้อมพิมพ์")).toBe(false);
  });
  it("explains excessive quantities without serialized validator errors", () => {
    expect(requestedCountError(10001, 50, true)).toContain("ห้องนี้รองรับ 50 คน");
    expect(requestedCountError(1.5, 50, true)).toContain("จำนวนเต็ม");
    expect(() => validateRequestedRooms([{ examRoomId: id, count: 10001 }], [{ examRoomId: id, capacity: 50 }], true)).toThrow("จำนวนชุดข้อสอบต้องไม่เกิน 10,000");
  });
});
