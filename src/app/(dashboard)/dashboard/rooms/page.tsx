import { asc } from "drizzle-orm";
import Link from "next/link";
import { DoorOpen, Plus, X } from "lucide-react";

import { RoomForm } from "@/components/setup-forms";
import { SetupRowActions } from "@/components/delete-setup-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRooms, rooms } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ editRoom?: string; new?: string }> }) {
  await requirePageRole([ROLES.OFFICER]);
  const [query, records, schedules] = await Promise.all([searchParams, db.select().from(rooms).orderBy(asc(rooms.code)), db.select({ roomId: examRooms.roomId }).from(examRooms)]);
  const initial = records.find(room => room.id === query.editRoom);
  const used = new Set(schedules.map(schedule => schedule.roomId));
  const showForm = !!initial || query.new === "1";
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">ข้อมูลห้องสอบ</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">จัดการห้อง อาคาร และความจุ แล้วเลือกใช้ห้องในหน้าตารางสอบ</p></div>{!showForm ? <Button asChild><Link href="?new=1#room-form"><Plus aria-hidden="true" />เพิ่มห้อง</Link></Button> : null}</div>
    {showForm ? <Card id="room-form" className="scroll-mt-24"><CardHeader><CardTitle>{initial ? "แก้ไขห้องสอบ" : "เพิ่มห้อง"}</CardTitle><CardDescription>{initial ? "การแก้ข้อมูลห้องไม่เปลี่ยนรายละเอียดซองในคำขอเดิม" : "ระบุชื่อห้องและความจุสำหรับจัดตารางสอบ"}</CardDescription><CardAction><Button asChild variant="ghost" size="sm"><Link href="/dashboard/rooms"><X aria-hidden="true" />ปิดฟอร์ม</Link></Button></CardAction></CardHeader><CardContent><RoomForm key={initial?.id ?? "new"} initial={initial} /></CardContent></Card> : null}
    <Card>
      <CardHeader><CardTitle>ห้องทั้งหมด <span className="ml-2 text-sm font-normal text-muted-foreground">{records.length} ห้อง</span></CardTitle></CardHeader>
      <CardContent><Table><TableHeader className="bg-muted/50"><TableRow>
        <TableHead className="hidden sm:table-cell">รหัส</TableHead><TableHead>ชื่อห้อง</TableHead><TableHead className="hidden md:table-cell">อาคาร</TableHead><TableHead>ความจุ</TableHead><TableHead className="hidden sm:table-cell">สถานะ</TableHead><TableHead className="w-24 text-right sm:w-48">จัดการ</TableHead>
      </TableRow></TableHeader><TableBody>
        {records.map(record => <TableRow key={record.id}>
          <TableCell className="hidden font-medium text-primary sm:table-cell">{record.code}</TableCell>
          <TableCell className="max-w-52 whitespace-normal"><p className="font-medium">{record.name}</p><p className="mt-1 break-all text-xs text-muted-foreground sm:hidden">{record.code}</p>{!record.isActive ? <p className="mt-1 text-xs text-muted-foreground sm:hidden">ปิดใช้งาน</p> : null}{record.building ? <p className="mt-1 text-xs text-muted-foreground md:hidden">{record.building}</p> : null}</TableCell>
          <TableCell className="hidden text-muted-foreground md:table-cell">{record.building || "ไม่ระบุ"}</TableCell><TableCell className="tabular-nums">{record.capacity} คน</TableCell><TableCell className="hidden sm:table-cell"><Badge variant="outline">{record.isActive ? "ใช้งาน" : "ปิด"}</Badge></TableCell>
          <TableCell><SetupRowActions kind="room" id={record.id} label={`${record.code} ${record.name}`} editHref={`?editRoom=${record.id}#room-form`} deleteDisabledReason={used.has(record.id) ? "มีตารางสอบอ้างอิงอยู่ ต้องลบตารางที่ยังไม่ถูกใช้ก่อนลบห้อง" : undefined} /></TableCell>
        </TableRow>)}
        {!records.length ? <TableRow><TableCell colSpan={6} className="py-12 text-center"><DoorOpen className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true" /><p className="font-medium">ยังไม่มีห้องสอบ</p><p className="mt-1 text-sm text-muted-foreground">กดเพิ่มห้องเพื่อระบุห้องที่พร้อมใช้สอบ</p></TableCell></TableRow> : null}
      </TableBody></Table></CardContent>
    </Card>
  </div>;
}
