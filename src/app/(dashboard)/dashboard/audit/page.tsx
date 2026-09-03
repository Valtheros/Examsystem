import { desc, ilike, or } from "drizzle-orm";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { BANGKOK_TIME_ZONE, ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageRole([ROLES.ADMIN]);
  const { q = "" } = await searchParams;
  const query = q.trim();
  const logs = await db
    .select()
    .from(auditLogs)
    .where(query ? or(ilike(auditLogs.actorUsernameSnapshot, `%${query}%`), ilike(auditLogs.action, `%${query}%`), ilike(auditLogs.targetType, `%${query}%`)) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);
  const formatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium", timeZone: BANGKOK_TIME_ZONE });
  return (
    <div className="space-y-7">
      <div><p className="text-sm font-medium text-primary">ความปลอดภัย</p><h1 className="text-3xl font-semibold">Audit Log</h1><p className="mt-2 text-muted-foreground">เก็บ snapshot ของ Username และบทบาท จึงยังอ่านได้แม้ลบบัญชีจาก Factory Reset</p></div>
      <Card><CardHeader><CardTitle>เหตุการณ์ล่าสุด</CardTitle><form className="relative mt-3 max-w-md"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input name="q" defaultValue={query} className="pl-9" placeholder="ค้นหา Username, action หรือชนิดข้อมูล" /></form></CardHeader>
        <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>เวลา</TableHead><TableHead>ผู้ดำเนินการ</TableHead><TableHead>เหตุการณ์</TableHead><TableHead>เป้าหมาย</TableHead><TableHead>รายละเอียด</TableHead></TableRow></TableHeader>
          <TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap">{formatter.format(log.createdAt)}</TableCell><TableCell><p>{log.actorUsernameSnapshot}</p><p className="text-xs text-muted-foreground">{log.actorRoleSnapshot}</p></TableCell><TableCell><Badge variant="outline">{log.action}</Badge></TableCell><TableCell>{log.targetType}<p className="max-w-40 truncate text-xs text-muted-foreground">{log.targetId ?? "-"}</p></TableCell><TableCell><code className="line-clamp-3 max-w-md whitespace-pre-wrap text-xs">{JSON.stringify(log.metadata)}</code></TableCell></TableRow>)}</TableBody>
        </Table></CardContent></Card>
    </div>
  );
}
