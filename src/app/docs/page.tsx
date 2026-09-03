import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <h1 className="text-3xl font-semibold">ขอบเขตระบบ</h1>
      <p className="mt-3 leading-8 text-muted-foreground">
        ระบบรองรับการสร้างรอบสอบและตารางรายวิชา อาจารย์ส่งต้นฉบับพร้อมแบบฟอร์ม
        หน่วยโสตตรวจและพิมพ์แยกตามห้อง เจ้าหน้าที่รับมอบและสแกน QR เพื่อบันทึกการแจกจ่าย
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {["ผู้ดูแลระบบ: สร้างและจัดการบัญชี", "เจ้าหน้าที่: รอบสอบ ห้อง และการแจกจ่าย", "อาจารย์: ส่งไฟล์และติดตามสถานะ", "หน่วยโสต: ตรวจ ตัด พิมพ์ และส่งมอบ"].map((item) => (
          <div key={item} className="rounded-xl border bg-card p-5">{item}</div>
        ))}
      </div>
      <Button asChild className="mt-8"><Link href="/">กลับหน้าหลัก</Link></Button>
    </main>
  );
}
