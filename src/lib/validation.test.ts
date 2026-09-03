import { describe, expect, it } from "vitest";

import { FACTORY_RESET_PHRASE, MAX_EXAM_FILE_BYTES } from "@/lib/constants";
import { factoryResetSchema, passwordSchema, uploadUrlSchema } from "@/lib/validation";

describe("security validation", () => {
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
