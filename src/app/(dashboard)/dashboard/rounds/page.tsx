import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { CalendarDays, Plus, X } from "lucide-react";

import { SetupRowActions } from "@/components/delete-setup-dialog";
import { ExamRoundForm } from "@/components/setup-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRequests, examRounds, subjects } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ editRound?: string; new?: string }> }) {
  await requirePageRole([ROLES.OFFICER]);
  const [query, records, subjectRows, references] = await Promise.all([
    searchParams,
    db.select().from(examRounds).orderBy(desc(examRounds.createdAt)),
    db.select({ roundId: subjects.roundId }).from(subjects),
    db.select({ roundId: subjects.roundId }).from(examRequests).innerJoin(subjects, eq(examRequests.subjectId, subjects.id)),
  ]);
  const locked = new Set(references.map(row => row.roundId));
  const counts = new Map<string, number>();
  for (const row of subjectRows) counts.set(row.roundId, (counts.get(row.roundId) ?? 0) + 1);
  const initial = records.find(round => round.id === query.editRound && !locked.has(round.id));
  const showForm = !!initial || query.new === "1";
  const lockedReason = "มีประวัติคำขอในรอบสอบนี้แล้ว จึงแก้ไขหรือลบไม่ได้ เพื่อรักษาคำขอและไฟล์เดิม";

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">รอบสอบ</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">จัดปี ภาคการศึกษา และช่วงเปิดรับข้อสอบ ก่อนเพิ่มรายวิชา</p></div>
      {!showForm ? <Button asChild><Link href="?new=1#round-form"><Plus aria-hidden="true" />สร้างรอบสอบ</Link></Button> : null}
    </div>
    {query.editRound && !initial ? <Alert><AlertDescription>ไม่พบรอบสอบที่แก้ไขได้ หรือรอบสอบนี้มีประวัติคำขอแล้ว</AlertDescription></Alert> : null}
    {showForm ? <Card id="round-form" className="scroll-mt-24"><CardHeader>
      <CardTitle>{initial ? "แก้ไขรอบสอบ" : "สร้างรอบสอบ"}</CardTitle>
      <CardDescription>เลือกกลางภาค ปลายภาค หรือกำหนดชื่อรอบสอบเอง</CardDescription>
      <CardAction><Button asChild variant="ghost" size="sm"><Link href="/dashboard/rounds"><X aria-hidden="true" />ปิดฟอร์ม</Link></Button></CardAction>
    </CardHeader><CardContent><ExamRoundForm key={initial?.id ?? "new"} initial={initial} /></CardContent></Card> : null}
    <Card><CardHeader><CardTitle>รอบสอบทั้งหมด <span className="ml-2 text-sm font-normal text-muted-foreground">{records.length} รอบ</span></CardTitle></CardHeader>
      <CardContent><Table><TableHeader className="bg-muted/50"><TableRow>
        <TableHead>รอบสอบ</TableHead><TableHead className="hidden sm:table-cell">ปี / ภาค</TableHead><TableHead className="hidden md:table-cell">ช่วงรับต้นฉบับ</TableHead><TableHead className="hidden sm:table-cell">รายวิชา</TableHead><TableHead className="hidden sm:table-cell">สถานะ</TableHead><TableHead className="w-24 text-right sm:w-48">จัดการ</TableHead>
      </TableRow></TableHeader><TableBody>
        {records.map(record => <TableRow key={record.id}>
          <TableCell className="max-w-56 whitespace-normal"><p className="font-medium text-primary">{record.name}</p><p className="mt-1 text-xs text-muted-foreground sm:hidden">{record.academicYear} / {record.semester} · {record.isActive ? "เปิดใช้งาน" : "ปิด"}</p><p className="mt-1 text-xs text-muted-foreground sm:hidden">{counts.get(record.id) ?? 0} วิชา</p>{record.submissionStartsOn || record.submissionEndsOn ? <p className="mt-1 text-xs text-muted-foreground md:hidden">รับ {record.submissionStartsOn ?? "ไม่กำหนดวันเริ่ม"}<br />ถึง {record.submissionEndsOn ?? "ไม่กำหนดวันสิ้นสุด"}</p> : null}</TableCell><TableCell className="hidden tabular-nums sm:table-cell">{record.academicYear} / {record.semester}</TableCell>
          <TableCell className="hidden md:table-cell">{record.submissionStartsOn || record.submissionEndsOn ? <div className="space-y-1 text-xs"><p>เริ่ม {record.submissionStartsOn ?? "ไม่ระบุ"}</p><p className="text-muted-foreground">ถึง {record.submissionEndsOn ?? "ไม่ระบุ"}</p></div> : <span className="text-muted-foreground">ไม่ได้กำหนด</span>}</TableCell>
          <TableCell className="hidden tabular-nums sm:table-cell">{counts.get(record.id) ?? 0} วิชา</TableCell><TableCell className="hidden sm:table-cell"><Badge variant="outline">{record.isActive ? "เปิดใช้งาน" : "ปิด"}</Badge></TableCell>
          <TableCell><SetupRowActions kind="round" id={record.id} label={`${record.name} ${record.academicYear}/${record.semester}`} editHref={`?editRound=${record.id}#round-form`} editDisabledReason={locked.has(record.id) ? lockedReason : undefined} deleteDisabledReason={locked.has(record.id) ? lockedReason : undefined} /></TableCell>
        </TableRow>)}
        {!records.length ? <TableRow><TableCell colSpan={6} className="py-12 text-center"><CalendarDays className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true" /><p className="font-medium">ยังไม่มีรอบสอบ</p><p className="mt-1 text-sm text-muted-foreground">กดสร้างรอบสอบเพื่อเริ่มจัดเตรียมการสอบ</p></TableCell></TableRow> : null}
      </TableBody></Table></CardContent>
    </Card>
  </div>;
}
