import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ScanDistribution } from "@/components/scan-distribution";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { deliveries, distributions, examRequests, requestRooms, subjects } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  await requirePageRole([ROLES.OFFICER]);
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();
  const [record] = await db
    .select({ room: requestRooms, request: examRequests, subject: subjects, delivery: deliveries, distributionId: distributions.id })
    .from(requestRooms)
    .innerJoin(examRequests, eq(requestRooms.requestId, examRequests.id))
    .innerJoin(subjects, eq(examRequests.subjectId, subjects.id))
    .innerJoin(deliveries, eq(deliveries.requestId, examRequests.id))
    .leftJoin(distributions, eq(distributions.requestRoomId, requestRooms.id))
    .where(eq(requestRooms.qrToken, token))
    .limit(1);
  if (!record) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div><p className="text-sm font-medium text-primary">สแกน QR ใบปะหน้า</p><h1 className="text-3xl font-semibold">ยืนยันการแจกจ่าย</h1></div>
      <Card><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>{record.subject.courseCode} {record.subject.courseName}</CardTitle><CardDescription className="mt-1">{record.request.requestNo}</CardDescription></div><Badge variant="outline">{record.room.printCount} ชุด</Badge></div></CardHeader><CardContent className="space-y-5"><div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4 text-sm"><div><p className="text-muted-foreground">ห้อง</p><p className="font-semibold">{record.room.roomCode} {record.room.roomName}</p></div><div><p className="text-muted-foreground">วันเวลา</p><p className="font-semibold">{record.room.examDate}<br />{record.room.startsAt.slice(0, 5)}–{record.room.endsAt.slice(0, 5)}</p></div><div><p className="text-muted-foreground">ผู้เข้าสอบ</p><p className="font-semibold">{record.room.studentCount} คน</p></div><div><p className="text-muted-foreground">ผู้ส่ง</p><p className="font-semibold">{record.room.senderName}</p></div></div><ScanDistribution token={token} completed={Boolean(record.distributionId)} /></CardContent></Card>
    </div>
  );
}
