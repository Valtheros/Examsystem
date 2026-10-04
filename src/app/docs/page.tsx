import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-controls";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 pb-16">
      <header className="mb-12 flex items-center justify-between border-b py-6"><Brand /><ThemeToggle /></header>
      <h1 className="text-3xl font-semibold">ขอบเขตระบบ</h1>
      <p className="mt-3 leading-8 text-muted-foreground">
        ระบบรองรับการสร้างรอบสอบและตารางรายวิชา อาจารย์ส่งต้นฉบับพร้อมแบบฟอร์ม
        หน่วยโสตตรวจและพิมพ์พร้อมใบปะหน้าแยกตามห้อง งานในระบบสิ้นสุดเมื่อยืนยันพิมพ์เสร็จ
      </p>
      <div className="mt-8 divide-y border-y">
        {["ผู้ดูแลระบบ: สร้างและจัดการบัญชี", "เจ้าหน้าที่: รอบสอบ ห้อง รายวิชาและตารางสอบ", "อาจารย์: ส่งไฟล์และติดตามสถานะ", "หน่วยโสต: ตรวจ เตรียมพิมพ์ และยืนยันพิมพ์เสร็จ"].map((item) => (
          <div key={item} className="py-5">{item}</div>
        ))}
      </div>
      <Button asChild className="mt-8"><Link href="/">กลับหน้าหลัก</Link></Button>
    </main>
  );
}
