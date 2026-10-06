import { and, desc, eq, getTableColumns, inArray, or } from "drizzle-orm";

import { RetryEmailButton } from "@/components/retry-email-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { examRequests, notifications } from "@/db/schema";
import { BANGKOK_TIME_ZONE, ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";
import { ACCOUNT_EMAIL_TYPES, getMailConfiguration } from "@/lib/mail";
import { TestEmailForm } from "@/components/test-email-form";

export default async function NotificationsPage() {
  await requirePageRole([ROLES.ADMIN]);
  const config = getMailConfiguration();
  const records = await db.select(getTableColumns(notifications)).from(notifications).leftJoin(examRequests, eq(notifications.requestId, examRequests.id))
    .where(or(eq(notifications.deliveryStatus, "Sent"), inArray(notifications.type, [...ACCOUNT_EMAIL_TYPES]), and(eq(notifications.type, "พิมพ์เสร็จ"), eq(notifications.userId, examRequests.instructorId))))
    .orderBy(desc(notifications.createdAt)).limit(300);
  const formatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: BANGKOK_TIME_ZONE });
  return <div className="space-y-7"><div><p className="text-sm font-medium text-primary">ผู้ดูแลระบบ</p><h1 className="text-3xl font-semibold">สถานะการส่งอีเมล</h1><p className="mt-2 text-muted-foreground">เมลงานข้อสอบส่งเฉพาะพิมพ์เสร็จถึงอาจารย์เจ้าของคำขอ · เมลบัญชีและประวัติส่งแล้วคงเดิม</p></div><section aria-labelledby="mail-configuration" className="space-y-4 border-b pb-7"><h2 id="mail-configuration" className="text-xl font-semibold">การตั้งค่าอีเมล</h2><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">โหมดส่ง</dt><dd className="mt-1 font-medium">{config.transport === "gmail-app-password" ? "Gmail · App Password" : config.transport === "gmail" ? "Gmail · OAuth2" : "SMTP · Mailpit / เซิร์ฟเวอร์ที่ตั้งไว้"}</dd></div><div><dt className="text-muted-foreground">ผู้ส่ง / ผู้รับเมลทดสอบ</dt><dd className="mt-1 break-all font-medium">{config.sender || "ยังไม่ได้ตั้งค่า"}</dd></div></dl><p className={config.configured ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{config.error || (config.transport === "smtp" ? "โหมด SMTP: Docker ในเครื่องส่งเข้า Mailpit ไม่ใช่ Gmail จริง" : "ตั้งค่าครบแล้ว กรุณาส่งเมลทดสอบและตรวจกล่องรับหรือ Spam ก่อนยืนยันว่าใช้งานได้")}</p><TestEmailForm configured={config.configured} /><p className="text-xs text-muted-foreground">Sent หมายถึงเซิร์ฟเวอร์ยอมรับการส่ง ไม่ได้ยืนยันว่าผู้รับอ่านแล้ว</p></section><Card><CardHeader><CardTitle>ประวัติการส่ง</CardTitle><CardDescription>หาก Gmail ปฏิเสธ งานหลักยังสำเร็จและกดส่งใหม่ได้</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>เวลา</TableHead><TableHead>ผู้รับ</TableHead><TableHead>ประเภท</TableHead><TableHead>สถานะ</TableHead><TableHead>ครั้ง</TableHead><TableHead /></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell className="whitespace-nowrap">{formatter.format(record.createdAt)}</TableCell><TableCell><p>{record.emailTo}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{record.subject}</p></TableCell><TableCell>{record.type}</TableCell><TableCell><Badge variant={record.deliveryStatus === "Sent" ? "default" : record.deliveryStatus === "Failed" ? "destructive" : "secondary"}>{record.deliveryStatus}</Badge>{record.lastError ? <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={record.lastError}>{record.lastError}</p> : null}</TableCell><TableCell>{record.attempts}</TableCell><TableCell>{record.deliveryStatus !== "Sent" ? <RetryEmailButton id={record.id} /> : null}</TableCell></TableRow>)}{!records.length ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">ยังไม่มีประวัติการส่งอีเมล</TableCell></TableRow> : null}</TableBody></Table></CardContent></Card></div>;
}
