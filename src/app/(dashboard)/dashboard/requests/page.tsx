import { Plus, Search } from "lucide-react";
import Link from "next/link";

import { RequestList } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { listRequests } from "@/lib/request-queries";
import { requirePageSession } from "@/lib/session";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const session = await requirePageSession();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const status = Object.values(REQUEST_STATUSES).find((value) => value === params.status);
  const records = await listRequests({
    instructorId: session.user.role === ROLES.INSTRUCTOR ? session.user.id : undefined,
    query,
    statuses: status ? [status] : undefined,
  });
  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-primary">ติดตามงาน</p><h1 className="text-3xl font-semibold">คำขอข้อสอบ</h1><p className="mt-2 text-muted-foreground">รายการยกเลิกจะไม่แสดงในหน้าปกติ แต่ยังคงอยู่ใน Audit Log</p></div>
        {session.user.role === ROLES.INSTRUCTOR ? <Button asChild><Link href="/dashboard/requests/new"><Plus className="size-4" /> สร้างคำขอ</Link></Button> : null}
      </div>
      <Card><CardHeader><CardTitle>รายการคำขอ · {records.length} รายการ</CardTitle>
        <form action="/dashboard/requests" className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2"><label htmlFor="requestSearch" className="text-sm">ค้นหาคำขอ</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="requestSearch" name="q" className="h-10 pl-9" placeholder="เลขคำขอ วิชา ผู้ส่ง หรือรอบสอบ" defaultValue={query} maxLength={200} /></div></div>
          <div className="space-y-2"><label htmlFor="statusFilter" className="text-sm">สถานะ</label><Select name="status" defaultValue={status ?? "all"}><SelectTrigger id="statusFilter" className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem>{Object.values(REQUEST_STATUSES).map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <Button type="submit" className="h-10">ค้นหา</Button>
          {(query || status) && <Button asChild variant="outline" className="h-10"><Link href="/dashboard/requests">ล้างตัวกรอง</Link></Button>}
        </form>
      </CardHeader><CardContent><RequestList records={records} /></CardContent></Card>
    </div>
  );
}
