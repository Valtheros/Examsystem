import { count, desc, eq } from "drizzle-orm";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { deliveries, distributions, examRequests, requestRooms, subjects } from "@/db/schema";
import { BANGKOK_TIME_ZONE, ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function DeliveriesPage() {
  await requirePageRole([ROLES.OFFICER, ROLES.AV_UNIT]);
  const records = await db
    .select({
      delivery: deliveries,
      requestNo: examRequests.requestNo,
      requestStatus: examRequests.status,
      courseCode: subjects.courseCode,
      courseName: subjects.courseName,
      roomCount: count(requestRooms.id),
      distributionCount: count(distributions.id),
    })
    .from(deliveries)
    .innerJoin(examRequests, eq(deliveries.requestId, examRequests.id))
    .innerJoin(subjects, eq(examRequests.subjectId, subjects.id))
    .leftJoin(requestRooms, eq(requestRooms.requestId, examRequests.id))
    .leftJoin(distributions, eq(distributions.requestRoomId, requestRooms.id))
    .groupBy(deliveries.id, examRequests.id, subjects.id)
    .orderBy(desc(deliveries.createdAt));
  const formatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: BANGKOK_TIME_ZONE });
  return (
    <div className="space-y-7">
      <div><p className="text-sm font-medium text-primary">การส่งต่อข้อสอบ</p><h1 className="text-3xl font-semibold">รับมอบและแจกจ่าย</h1><p className="mt-2 text-muted-foreground">การแจกจ่ายบันทึกแยกตามห้องจาก QR Code บนใบปะหน้า</p></div>
      <Card><CardHeader><CardTitle>รายการส่งมอบ</CardTitle><CardDescription>จำนวนแจกแล้วเทียบกับจำนวนห้องสอบทั้งหมด</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>คำขอ</TableHead><TableHead>รายวิชา</TableHead><TableHead>ผู้รับ</TableHead><TableHead>ส่งมอบเมื่อ</TableHead><TableHead>แจกจ่าย</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.delivery.id}><TableCell className="font-medium">{record.requestNo}</TableCell><TableCell>{record.courseCode} {record.courseName}</TableCell><TableCell>{record.delivery.receiverNameSnapshot ?? "รอรับมอบ"}</TableCell><TableCell>{record.delivery.deliveredAt ? formatter.format(record.delivery.deliveredAt) : "-"}</TableCell><TableCell><Badge variant={record.distributionCount === record.roomCount ? "default" : "outline"}>{record.distributionCount}/{record.roomCount} ห้อง</Badge></TableCell><TableCell><StatusBadge status={record.requestStatus} /></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </div>
  );
}
