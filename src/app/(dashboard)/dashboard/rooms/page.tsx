import { asc } from "drizzle-orm";

import { RoomForm } from "@/components/setup-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function RoomsPage() {
  await requirePageRole([ROLES.OFFICER]);
  const records = await db.select().from(rooms).orderBy(asc(rooms.code));
  return <div className="space-y-7"><div><p className="text-sm font-medium text-primary">เจ้าหน้าที่</p><h1 className="text-3xl font-semibold">ข้อมูลห้องสอบ</h1><p className="mt-2 text-muted-foreground">เพิ่มห้องและความจุก่อน จากนั้นไปจัดรายวิชาและตารางสอบเพื่อเลือกใช้ห้อง</p></div>
    <Card><CardHeader><CardTitle>เพิ่มห้อง</CardTitle></CardHeader><CardContent><RoomForm /></CardContent></Card>
    <Card><CardHeader><CardTitle>ห้องทั้งหมด</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>รหัส</TableHead><TableHead>ชื่อ</TableHead><TableHead>อาคาร</TableHead><TableHead>ความจุ</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell className="font-medium">{record.code}</TableCell><TableCell>{record.name}</TableCell><TableCell>{record.building ?? "-"}</TableCell><TableCell>{record.capacity}</TableCell><TableCell><Badge variant="outline">{record.isActive ? "ใช้งาน" : "ปิด"}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}
