export const INSTRUCTOR_STATUS_NOTIFICATIONS = {
  "ตัดข้อสอบ": "รับคำขอ",
  "ปฏิเสธ/ส่งกลับแก้ไข": "ส่งกลับแก้ไข",
  "กำลังพิมพ์": "เริ่มพิมพ์",
  "พิมพ์เสร็จแล้ว": "พิมพ์เสร็จ",
} as const;

export type InstructorNotification = {
  id: string;
  requestId: string;
  requestNo: string;
  courseCode: string;
  courseName: string;
  status: keyof typeof INSTRUCTOR_STATUS_NOTIFICATIONS;
  reason: string | null;
  createdAt: string;
};
