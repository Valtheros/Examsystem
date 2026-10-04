"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="max-w-xl space-y-5 py-8"><p className="text-sm font-medium text-destructive">โหลดข้อมูลไม่สำเร็จ</p><h1 className="text-2xl font-semibold">ยังเปิดหน้านี้ไม่ได้</h1><p className="text-muted-foreground">กรุณาลองอีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ ไม่ต้องสร้างรายการใหม่ซ้ำ</p><Button onClick={reset}>ลองโหลดอีกครั้ง</Button></section>;
}
