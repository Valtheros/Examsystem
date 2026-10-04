import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-controls";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between border-b py-6">
        <Brand />
        <ThemeToggle />
      </header>
      <section className="max-w-2xl py-16 sm:py-24">
        <p className="mb-4 text-sm font-medium text-primary">มหาวิทยาลัยสงขลานครินทร์</p>
        <h1 className="text-3xl font-semibold leading-snug sm:text-5xl">
          ระบบจัดพิมพ์ข้อสอบ<br />
          <span className="text-muted-foreground">คณะวิทยาศาสตร์</span>
        </h1>
        <p className="mt-6 max-w-xl leading-8 text-muted-foreground">
          ส่งไฟล์ข้อสอบพร้อมแบบฟอร์ม ตรวจรายละเอียด และจัดพิมพ์พร้อมใบปะหน้าซองแยกตามห้องสอบ
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/login">เข้าสู่ระบบ <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          ใช้บัญชีที่ผู้ดูแลระบบสร้างให้ หากยังไม่มีบัญชี กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </section>
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t py-6 text-sm text-muted-foreground">
        <span>ระบบสำหรับอาจารย์และบุคลากรของคณะ</span>
        <Link href="/docs" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">ดูขอบเขตระบบ</Link>
      </footer>
    </main>
  );
}
