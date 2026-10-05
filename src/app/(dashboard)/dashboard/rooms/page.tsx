import { asc } from "drizzle-orm";
import Link from "next/link";

import { RoomForm } from "@/components/setup-forms";
import { DeleteSetupDialog } from "@/components/delete-setup-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRooms, rooms } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ editRoom?: string }> }) {
  await requirePageRole([ROLES.OFFICER]);
  const [query, records, schedules] = await Promise.all([searchParams, db.select().from(rooms).orderBy(asc(rooms.code)), db.select({ roomId: examRooms.roomId }).from(examRooms)]);
  const initial = records.find(room => room.id === query.editRoom);
  const used = new Set(schedules.map(schedule => schedule.roomId));
  return <div className="space-y-7"><div><p className="text-sm font-medium text-primary">เจ้าหน้าที่</p><h1 className="text-3xl font-semibold">ข้อมูลห้องสอบ</h1><p className="mt-2 text-muted-foreground">เพิ่มห้องและความจุก่อน จากนั้นไปจัดรายวิชาและตารางสอบเพื่อเลือกใช้ห้อง</p></div>
    <Card id="room-form"><CardHeader><CardTitle>{initial ? "แก้ไขห้องสอบ" : "เพิ่มห้อง"}</CardTitle>{initial ? <p className="text-sm text-muted-foreground">แก้ข้อมูลห้อง ไม่เปลี่ยนรายละเอียดซองในคำขอเดิม · <Link href="/dashboard/rooms" className="text-primary underline">กลับไปเพิ่มห้องใหม่</Link></p> : null}</CardHeader><CardContent><RoomForm key={initial?.id ?? "new"} initial={initial} /></CardContent></Card>
    <Card><CardHeader><CardTitle>ห้องทั้งหมด</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>รหัส</TableHead><TableHead>ชื่อ</TableHead><TableHead>อาคาร</TableHead><TableHead>ความจุ</TableHead><TableHead>สถานะ</TableHead><TableHead>จัดการ</TableHead></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell className="font-medium">{record.code}</TableCell><TableCell>{record.name}</TableCell><TableCell>{record.building ?? "-"}</TableCell><TableCell>{record.capacity}</TableCell><TableCell><Badge variant="outline">{record.isActive ? "ใช้งาน" : "ปิด"}</Badge></TableCell><TableCell><div className="flex flex-wrap items-start gap-3"><Link className="py-2 text-primary underline" href={`?editRoom=${record.id}#room-form`}>แก้ไขห้อง</Link><DeleteSetupDialog kind="room" id={record.id} label={`${record.code} ${record.name}`} disabledReason={used.has(record.id) ? "มีตารางสอบอ้างอิงอยู่ ต้องลบตารางที่ยังไม่ถูกใช้ก่อน" : undefined} /></div></TableCell></TableRow>)}{!records.length ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">ยังไม่มีห้องสอบ เพิ่มห้องและความจุด้านบน</TableCell></TableRow> : null}</TableBody></Table></CardContent></Card>
  </div>;
}
