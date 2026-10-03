import { desc } from "drizzle-orm";

import { ExamRoundForm } from "@/components/setup-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRounds } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function RoundsPage() {
  await requirePageRole([ROLES.OFFICER]);
  const records = await db.select().from(examRounds).orderBy(desc(examRounds.createdAt));
  return <div className="space-y-7"><div><p className="text-sm font-medium text-primary">เจ้าหน้าที่</p><h1 className="text-3xl font-semibold">รอบสอบ</h1><p className="mt-2 text-muted-foreground">เริ่มจากสร้างรอบสอบ ระบุปี ภาคการศึกษา และช่วงเปิดรับข้อสอบ</p></div>
    <Card><CardHeader><CardTitle>สร้างรอบสอบ</CardTitle></CardHeader><CardContent><ExamRoundForm /></CardContent></Card>
    <Card><CardHeader><CardTitle>รอบสอบทั้งหมด</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ชื่อ</TableHead><TableHead>ปี/ภาค</TableHead><TableHead>ช่วงรับต้นฉบับ</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell className="font-medium">{record.name}</TableCell><TableCell>{record.academicYear} / {record.semester}</TableCell><TableCell>{record.submissionStartsOn ?? "-"} – {record.submissionEndsOn ?? "-"}</TableCell><TableCell><Badge variant={record.isActive ? "default" : "secondary"}>{record.isActive ? "เปิด" : "ปิด"}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}
