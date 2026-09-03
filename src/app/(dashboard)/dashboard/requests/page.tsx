import { Plus, Search } from "lucide-react";
import Link from "next/link";

import { RequestList } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLES } from "@/lib/constants";
import { listRequests } from "@/lib/request-queries";
import { requirePageSession } from "@/lib/session";

export default async function RequestsPage() {
  const session = await requirePageSession();
  const records = await listRequests({
    instructorId: session.user.role === ROLES.INSTRUCTOR ? session.user.id : undefined,
  });
  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-primary">ติดตามงาน</p><h1 className="text-3xl font-semibold">คำขอข้อสอบ</h1><p className="mt-2 text-muted-foreground">รายการยกเลิกจะไม่แสดงในหน้าปกติ แต่ยังคงอยู่ใน Audit Log</p></div>
        {session.user.role === ROLES.INSTRUCTOR ? <Button asChild><Link href="/dashboard/requests/new"><Plus className="size-4" /> สร้างคำขอ</Link></Button> : null}
      </div>
      <Card><CardHeader><CardTitle>รายการทั้งหมด</CardTitle><div className="relative mt-3 max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="ใช้ตัวกรองรายวิชา/สถานะ (กำลังพัฒนา)" disabled /></div></CardHeader><CardContent><RequestList records={records} /></CardContent></Card>
    </div>
  );
}
