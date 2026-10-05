import { describe, expect, it } from "vitest";

import { FACTORY_RESET_PHRASE, MAX_EXAM_FILE_BYTES } from "@/lib/constants";
import { examRoundSchema, factoryResetSchema, passwordSchema, subjectSchema, transitionSchema, uploadUrlSchema } from "@/lib/validation";
import { PSU_FACULTY_NAMES } from "@/lib/psu-faculties";

describe("security validation", () => {
  it("requires a faculty when creating or editing a subject", () => {
    const subject = { roundId: "019b2b45-4d7a-7000-8000-000000000001", courseCode: "345-211", courseName: "Programming", groupNo: "1", instructorId: "teacher" };
    expect(subjectSchema.safeParse(subject).success).toBe(false);
    expect(subjectSchema.safeParse({ ...subject, facultyName: "   " }).success).toBe(false);
    expect(subjectSchema.parse({ ...subject, facultyName: " คณะวิศวกรรมศาสตร์ " }).facultyName).toBe("คณะวิศวกรรมศาสตร์");
    expect(PSU_FACULTY_NAMES).toHaveLength(16);
    expect(subjectSchema.safeParse({ ...subject, facultyName: "คณะศึกษาศาสตร์" }).success).toBe(false);
    expect(subjectSchema.safeParse({ ...subject, facultyName: "วิทยาลัยนานาชาติ" }).success).toBe(false);
  });
  it("accepts standard and custom exam rounds but rejects the removed handover status", () => {
    for (const name of ["กลางภาค", "ปลายภาค", "สอบชดเชย"]) expect(examRoundSchema.safeParse({ name, academicYear: "2569", semester: "1" }).success).toBe(true);
    expect(transitionSchema.safeParse({ requestId: "019b2b45-4d7a-7000-8000-000000000001", toStatus: "ส่งมอบแล้ว" }).success).toBe(false);
  });
  it("enforces a 12-character mixed password", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("StrongPassword123").success).toBe(true);
  });

  it("accepts only PDF metadata at or below 100 MB", () => {
    const base = {
      requestId: "019b2b45-4d7a-7000-8000-000000000001",
      fileName: "exam.pdf",
      contentType: "application/pdf" as const,
      sha256: "a".repeat(64),
      kind: "ต้นฉบับ" as const,
    };
    expect(uploadUrlSchema.safeParse({ ...base, fileSize: MAX_EXAM_FILE_BYTES }).success).toBe(true);
    expect(uploadUrlSchema.safeParse({ ...base, fileSize: MAX_EXAM_FILE_BYTES + 1 }).success).toBe(false);
    expect(uploadUrlSchema.safeParse({ ...base, contentType: "image/png", fileSize: 10 }).success).toBe(false);
  });

  it("requires the exact irreversible reset phrase", () => {
    expect(factoryResetSchema.safeParse({ currentPassword: "x", confirmation: FACTORY_RESET_PHRASE }).success).toBe(true);
    expect(factoryResetSchema.safeParse({ currentPassword: "x", confirmation: "reset" }).success).toBe(false);
  });
});
