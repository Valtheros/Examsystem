import { z } from "zod";

import {
  APP_ROLES,
  FACTORY_RESET_PHRASE,
  MAX_EXAM_FILE_BYTES,
  REQUEST_STATUSES,
} from "./constants";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username ต้องมีอย่างน้อย 3 ตัวอักษร")
  .max(50, "Username ต้องไม่เกิน 50 ตัวอักษร")
  .regex(/^[a-zA-Z0-9._-]+$/, "Username ใช้ได้เฉพาะ a-z, 0-9, จุด ขีดกลาง และขีดล่าง");

export const passwordSchema = z
  .string()
  .min(12, "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร")
  .max(128, "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร")
  .regex(/[a-z]/, "รหัสผ่านต้องมีตัวอักษรพิมพ์เล็ก")
  .regex(/[A-Z]/, "รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่")
  .regex(/[0-9]/, "รหัสผ่านต้องมีตัวเลข");

export const createUserSchema = z.object({
  username: usernameSchema,
  email: z.email("อีเมลไม่ถูกต้อง").max(254),
  name: z.string().trim().min(2).max(120),
  role: z.enum(APP_ROLES),
  initialPassword: passwordSchema,
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  email: z.email("อีเมลไม่ถูกต้อง").max(254),
  name: z.string().trim().min(2).max(120),
  role: z.enum(APP_ROLES),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านชั่วคราว"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่านใหม่"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน",
  });

export const examRoundSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    academicYear: z.string().trim().min(4).max(10),
    semester: z.string().trim().min(1).max(20),
    submissionStartsOn: z.string().date().optional().or(z.literal("")),
    submissionEndsOn: z.string().date().optional().or(z.literal("")),
  })
  .refine(
    (value) =>
      !value.submissionStartsOn ||
      !value.submissionEndsOn ||
      value.submissionStartsOn <= value.submissionEndsOn,
    { message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น", path: ["submissionEndsOn"] },
  );

export const roomSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(100),
  building: z.string().trim().max(100).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(0).max(10000),
});

export const subjectSchema = z.object({
  roundId: z.uuid(),
  courseCode: z.string().trim().min(2).max(30),
  courseName: z.string().trim().min(2).max(200),
  groupNo: z.string().trim().min(1).max(30),
  instructorId: z.string().min(1),
});

export const examRoomSchema = z
  .object({
    subjectId: z.uuid(),
    roomId: z.uuid(),
    examDate: z.string().date(),
    startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((value) => value.startsAt < value.endsAt, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endsAt"],
  });

export const examRequestSchema = z.object({
  subjectId: z.uuid(),
  pageCount: z.coerce.number().int().min(1).max(1000),
  printDetail: z.string().trim().max(5000).optional().or(z.literal("")),
});

export const transitionSchema = z.object({
  requestId: z.uuid(),
  toStatus: z.enum([
    REQUEST_STATUSES.PENDING_REVIEW,
    REQUEST_STATUSES.RETURNED,
    REQUEST_STATUSES.CUTTING,
    REQUEST_STATUSES.PRINTING,
    REQUEST_STATUSES.PRINTED,
  ]),
  reason: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const uploadUrlSchema = z.object({
  requestId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().min(1).max(MAX_EXAM_FILE_BYTES),
  contentType: z.literal("application/pdf"),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  kind: z.enum(["ต้นฉบับ", "พร้อมพิมพ์"]).default("ต้นฉบับ"),
});

export const completeUploadSchema = uploadUrlSchema.extend({
  storageKey: z.string().min(1).max(1024),
});

export const factoryResetSchema = z.object({
  currentPassword: z.string().min(1),
  confirmation: z.literal(FACTORY_RESET_PHRASE),
  storageOnly: z.boolean().optional().default(false),
});
