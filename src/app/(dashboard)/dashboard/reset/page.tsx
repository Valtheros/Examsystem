import { FactoryResetForm } from "@/components/factory-reset-form";
import { ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function ResetPage() {
  await requirePageRole([ROLES.ADMIN]);
  return (
    <div className="mx-auto max-w-3xl space-y-8 sm:space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">จัดการข้อมูลระบบ</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">เลือกขอบเขตที่ต้องการล้าง ตรวจสอบให้ครบก่อนยืนยัน การดำเนินการนี้ใช้ได้เฉพาะผู้ดูแลระบบ</p>
      </header>
      <section aria-labelledby="clear-exam-data" className="space-y-6 border-t pt-7">
        <div className="flex items-start gap-3">
          <Trash2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
          <div>
            <h2 id="clear-exam-data" className="text-xl font-semibold">ล้างข้อมูลงานสอบ</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">เริ่มเตรียมงานสอบใหม่ โดยไม่ต้องสร้างบัญชีผู้ใช้ซ้ำ</p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-l-2 border-primary bg-feature px-4 py-4 text-feature-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">เก็บผู้ใช้ทุกบัญชีไว้</p>
            <p className="text-sm leading-relaxed">ชื่อบัญชี รหัสผ่าน บทบาท และการเข้าสู่ระบบเดิมไม่เปลี่ยน รวมถึงประวัติ Audit Log</p>
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">ข้อมูลที่จะลบ</h3>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>รอบสอบ รายวิชา ห้องสอบ และตารางสอบทั้งหมด</li>
            <li>คำขอ แบบฟอร์ม จำนวนรายห้อง งานพิมพ์ และประวัติสถานะ</li>
            <li>ไฟล์ข้อสอบและใบปะหน้าทุกเวอร์ชัน รวมถึงรายการแจ้งเตือนอีเมล</li>
          </ul>
        </div>
        <p className="text-sm font-medium text-destructive">ลบถาวรและกู้คืนไม่ได้ กรุณาแจ้งผู้ใช้งานก่อนดำเนินการ</p>
        <FactoryResetForm scope="exam-data" />
      </section>
      <section aria-labelledby="factory-reset" className="space-y-4 border-t pt-7">
        <h2 id="factory-reset" className="text-lg font-semibold">Factory Reset</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">ใช้เมื่อต้องการเริ่มทั้งระบบใหม่ ตัวเลือกนี้ลบผู้ใช้อื่นด้วย เหลือเฉพาะบัญชีผู้ดูแลที่กดยืนยันและ Audit Log ไม่ใช่การล้างงานสอบด้านบน</p>
        <FactoryResetForm />
      </section>
      <p className="border-t pt-5 text-sm text-muted-foreground">การล้างทั้งสองแบบเก็บประวัติการดำเนินการไว้ใน <Link href="/dashboard/audit" className="font-medium text-primary underline underline-offset-4">Audit Log</Link></p>
    </div>
  );
}
