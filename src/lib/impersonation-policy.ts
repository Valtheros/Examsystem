import { ROLES } from "@/lib/constants";

export function impersonationBlockReason(target: { role: string; banned?: boolean | null; mustChangePassword?: boolean }) {
  if (target.role === ROLES.ADMIN) return "ไม่อนุญาตให้เข้าใช้งานแทนผู้ดูแลระบบ";
  if (target.banned) return "บัญชีนี้ถูกปิดใช้งาน";
  if (target.mustChangePassword) return "ผู้ใช้ต้องเปลี่ยนรหัสผ่านชั่วคราวครั้งแรกก่อน";
  return null;
}
