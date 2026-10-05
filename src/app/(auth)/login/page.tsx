import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, FileCheck2, Printer } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(session.user.mustChangePassword ? "/change-password" : "/dashboard");
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <AuthShell>
      <div className="grid w-full overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[1.05fr_1fr]">
        <section className="flex flex-col justify-between gap-10 border-b bg-feature px-7 py-6 text-feature-foreground sm:px-10 lg:border-b-0 lg:border-r lg:p-12" aria-label="เกี่ยวกับระบบ">
          <div>
            <p className="mb-3 text-sm font-medium lg:mb-4">สำหรับอาจารย์และบุคลากร</p>
            <h2 className="text-xl font-semibold leading-[1.5] sm:text-2xl lg:text-4xl">จัดการข้อสอบ<br />ตั้งแต่ส่งจนพิมพ์เสร็จ</h2>
            <p className="mt-5 hidden max-w-sm text-base leading-7 opacity-85 lg:block">จัดตาราง ส่งไฟล์ และติดตามงานพิมพ์<br />ในพื้นที่ทำงานเดียวกัน</p>
          </div>
          <ol className="hidden divide-y divide-current/15 lg:block">
            {[
              { icon: CalendarDays, title: "จัดตารางสอบ", detail: "กำหนดวิชา วัน เวลา และห้องสอบ" },
              { icon: FileCheck2, title: "ส่งและตรวจข้อสอบ", detail: "แนบ PDF พร้อมรายละเอียดการพิมพ์" },
              { icon: Printer, title: "พิมพ์และจัดซอง", detail: "เตรียมข้อสอบพร้อมใบปะหน้ารายห้อง" },
            ].map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <Icon className="mt-1 size-5 shrink-0" aria-hidden="true" />
                <div><p className="font-medium">{title}</p><p className="mt-1 text-sm opacity-85">{detail}</p></div>
              </li>
            ))}
          </ol>
        </section>
        <div className="flex items-center justify-center p-7 sm:p-10 lg:p-12"><LoginForm nextPath={safeNext} /></div>
      </div>
    </AuthShell>
  );
}
