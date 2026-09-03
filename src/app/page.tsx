import {
  ArrowRight,
  CheckCircle2,
  FileLock2,
  PrinterCheck,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

const stages = [
  "เตรียมรอบสอบ",
  "ส่งต้นฉบับ",
  "ตรวจและตัดข้อสอบ",
  "พิมพ์และส่งมอบ",
  "แจกจ่ายเข้าห้องสอบ",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <PrinterCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">คณะวิทยาศาสตร์</p>
            <p className="text-xs text-muted-foreground">Exam Operations</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/login">เข้าสู่ระบบ</Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.12fr_.88fr] lg:items-center lg:pt-24">
        <div>
          <Badge variant="secondary" className="mb-5 rounded-full px-3 py-1">
            <ShieldCheck className="mr-1 size-3.5" /> ไฟล์ส่วนตัว · ตรวจสอบย้อนหลังได้
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.18] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {APP_NAME}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            รวมการส่งต้นฉบับ การตรวจ ตัด พิมพ์ ส่งมอบ และแจกจ่ายข้อสอบไว้ในขั้นตอนเดียว
            พร้อมกำหนดสิทธิ์ตามหน้าที่และเก็บประวัติทุกเหตุการณ์สำคัญ
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl px-6">
              <Link href="/login">
                เริ่มใช้งาน <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl px-6">
              <Link href="/docs">ดูขอบเขตระบบ</Link>
            </Button>
          </div>
        </div>

        <div className="relative rounded-[2rem] border bg-card/90 p-5 shadow-2xl shadow-primary/10 backdrop-blur sm:p-7">
          <div className="absolute -right-16 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ภาพรวมกระบวนการ</p>
              <p className="text-xl font-semibold">จากอาจารย์ถึงห้องสอบ</p>
            </div>
            <FileLock2 className="size-8 text-primary" />
          </div>
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div
                key={stage}
                className="flex items-center gap-4 rounded-2xl border bg-background/80 px-4 py-3.5"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <span className="flex-1 font-medium">{stage}</span>
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
