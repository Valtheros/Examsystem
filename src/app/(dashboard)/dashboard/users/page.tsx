import { ilike, or, desc } from "drizzle-orm";
import { Search, ShieldCheck, UserPlus } from "lucide-react";

import { setUserActiveAction } from "@/actions/admin";
import { CreateUserForm, EditUserForm, ResetPasswordForm } from "@/components/admin-forms";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { user } from "@/db/schema";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requirePageRole([ROLES.ADMIN]);
  const { q = "" } = await searchParams;
  const query = q.trim();
  const records = await db
    .select()
    .from(user)
    .where(query ? or(ilike(user.name, `%${query}%`), ilike(user.username, `%${query}%`), ilike(user.email, `%${query}%`)) : undefined)
    .orderBy(desc(user.createdAt));

  return (
    <div className="space-y-7">
      <div><p className="text-sm font-medium text-primary">ผู้ดูแลระบบ</p><h1 className="text-3xl font-semibold">จัดการผู้ใช้</h1><p className="mt-2 text-muted-foreground">สร้างบัญชี กำหนดบทบาท ปิดบัญชี และรีเซ็ตรหัสผ่าน ไม่มี self-registration</p></div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-5" /> สร้างบัญชีใหม่</CardTitle><CardDescription>ผู้ใช้จะต้องเปลี่ยนรหัสผ่านชั่วคราวเมื่อเข้าสู่ระบบครั้งแรก</CardDescription></CardHeader>
        <CardContent><CreateUserForm /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>บัญชีทั้งหมด</CardTitle>
          <form className="relative mt-3 max-w-md"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input name="q" defaultValue={query} className="pl-9" placeholder="ค้นหาชื่อ Username หรืออีเมล" /></form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>ผู้ใช้</TableHead><TableHead>บทบาท</TableHead><TableHead>สถานะ</TableHead><TableHead className="min-w-56">จัดการ</TableHead></TableRow></TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell><p className="font-medium">{record.name}</p><p className="text-xs text-muted-foreground">{record.username} · {record.email}</p></TableCell>
                  <TableCell><Badge variant="secondary">{record.role}</Badge></TableCell>
                  <TableCell>{record.banned ? <Badge variant="destructive">ปิดใช้งาน</Badge> : <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">เปิดใช้งาน</Badge>}</TableCell>
                  <TableCell className="space-y-3">
                    <form action={setUserActiveAction}>
                      <input type="hidden" name="userId" value={record.id} />
                      <input type="hidden" name="active" value={String(record.banned)} />
                      <SubmitButton size="sm" variant="outline" disabled={record.id === session.user.id}>{record.banned ? "เปิดบัญชี" : "ปิดบัญชี"}</SubmitButton>
                    </form>
                    <details><summary className="cursor-pointer text-sm text-primary">แก้ไขข้อมูลและบทบาท</summary><div className="mt-2"><EditUserForm record={record} /></div></details>
                    <details><summary className="cursor-pointer text-sm text-primary">ตั้งรหัสผ่านชั่วคราว</summary><div className="mt-2"><ResetPasswordForm userId={record.id} /></div></details>
                  </TableCell>
                </TableRow>
              ))}
              {!records.length ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">ไม่พบผู้ใช้</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> การแก้ไขบัญชีสำคัญถูกบันทึกใน Audit Log</div>
    </div>
  );
}
