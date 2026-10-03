export const APP_NAME = "ระบบจัดพิมพ์ข้อสอบ คณะวิทยาศาสตร์";

export const ROLES = {
  ADMIN: "ผู้ดูแลระบบ",
  OFFICER: "เจ้าหน้าที่",
  INSTRUCTOR: "อาจารย์",
  AV_UNIT: "หน่วยโสต",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const APP_ROLES = Object.values(ROLES) as [AppRole, ...AppRole[]];

export const REQUEST_STATUSES = {
  DRAFT: "ฉบับร่าง",
  PENDING_REVIEW: "รอตรวจสอบ",
  RETURNED: "ปฏิเสธ/ส่งกลับแก้ไข",
  CUTTING: "ตัดข้อสอบ",
  PRINTING: "กำลังพิมพ์",
  PRINTED: "พิมพ์เสร็จแล้ว",
} as const;

// Kept only for reading historical rows. New work ends at PRINTED.
export const LEGACY_DELIVERED_STATUS = "ส่งมอบแล้ว" as const;
export type RequestStatus =
  (typeof REQUEST_STATUSES)[keyof typeof REQUEST_STATUSES] | typeof LEGACY_DELIVERED_STATUS;

export const MAX_EXAM_FILE_BYTES = 100 * 1024 * 1024;
export const UPLOAD_URL_EXPIRES_SECONDS = 5 * 60;
export const DOWNLOAD_URL_EXPIRES_SECONDS = 60;
export const FACTORY_RESET_PHRASE = "RESET EXAM SYSTEM";

export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export const ROLE_LABELS: Record<AppRole, string> = {
  [ROLES.ADMIN]: "จัดการผู้ใช้และตรวจสอบระบบ",
  [ROLES.OFFICER]: "จัดการรอบสอบ รายวิชา ห้อง และตารางสอบ",
  [ROLES.INSTRUCTOR]: "ส่งต้นฉบับและติดตามคำขอของตนเอง",
  [ROLES.AV_UNIT]: "ตรวจข้อสอบ เตรียมพิมพ์ และยืนยันพิมพ์เสร็จ",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}
