import { desc } from "drizzle-orm";

import { RetryEmailButton } from "@/components/retry-email-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { BANGKOK_TIME_ZONE, ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function NotificationsPage() {
  await requirePageRole([ROLES.ADMIN]);
  const records = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(300);
  const formatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: BANGKOK_TIME_ZONE });
  return <div className="space-y-7"><div><p className="text-sm font-medium text-primary">ผู้ดูแลระบบ</p><h1 className="text-3xl font-semibold">สถานะการส่งอีเมล</h1><p className="mt-2 text-muted-foreground">ไม่มีสถานะอ่านแล้ว เก็บเฉพาะ Pending, Sent และ Failed ตามผลการส่งจริง</p></div><Card><CardHeader><CardTitle>ประวัติการส่ง</CardTitle><CardDescription>หาก Gmail ปฏิเสธ งานหลักยังสำเร็จและกดส่งใหม่ได้</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>เวลา</TableHead><TableHead>ผู้รับ</TableHead><TableHead>ประเภท</TableHead><TableHead>สถานะ</TableHead><TableHead>ครั้ง</TableHead><TableHead /></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell className="whitespace-nowrap">{formatter.format(record.createdAt)}</TableCell><TableCell><p>{record.emailTo}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{record.subject}</p></TableCell><TableCell>{record.type}</TableCell><TableCell><Badge variant={record.deliveryStatus === "Sent" ? "default" : record.deliveryStatus === "Failed" ? "destructive" : "secondary"}>{record.deliveryStatus}</Badge>{record.lastError ? <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={record.lastError}>{record.lastError}</p> : null}</TableCell><TableCell>{record.attempts}</TableCell><TableCell>{record.deliveryStatus === "Failed" ? <RetryEmailButton id={record.id} /> : null}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></div>;
}
