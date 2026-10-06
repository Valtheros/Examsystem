import { and, eq, ilike, or, desc } from "drizzle-orm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
import { ImpersonateButton } from "@/components/impersonation";
import { impersonationBlockReason } from "@/lib/impersonation-policy";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const session = await requirePageRole([ROLES.ADMIN]);
  const { q = "", role = "all" } = await searchParams;
  const query = q.trim();
  const records = await db
    .select()
    .from(user)
    .where(and(query ? or(ilike(user.name, `%${query}%`), ilike(user.username, `%${query}%`), ilike(user.email, `%${query}%`)) : undefined, Object.values(ROLES).some((value) => value === role) ? eq(user.role, role) : undefined))
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
          <form className="mt-3 flex flex-wrap gap-3"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input name="q" aria-label="ค้นหาผู้ใช้" defaultValue={query} className="pl-9" placeholder="ค้นหาชื่อ Username หรืออีเมล" /></div><Select name="role" defaultValue={role}><SelectTrigger aria-label="กรองบทบาท" className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกบทบาท</SelectItem>{Object.values(ROLES).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Button type="submit">ค้นหา</Button></form>
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
                  <TableCell><details><summary className="min-h-11 text-sm font-medium text-primary">จัดการบัญชี</summary><div className="mt-3 space-y-3">
                    <ImpersonateButton userId={record.id} username={record.username ?? record.name} disabledReason={impersonationBlockReason(record)} />
                    <form action={setUserActiveAction}>
                      <input type="hidden" name="userId" value={record.id} />
                      <input type="hidden" name="active" value={String(record.banned)} />
                      <SubmitButton size="sm" variant="outline" disabled={record.id === session.user.id}>{record.banned ? "เปิดบัญชี" : "ปิดบัญชี"}</SubmitButton>
                    </form>
                    <details><summary className="cursor-pointer text-sm text-primary">แก้ไขข้อมูลและบทบาท</summary><div className="mt-2"><EditUserForm record={record} /></div></details>
                    <details><summary className="cursor-pointer text-sm font-medium text-primary">{record.mustChangePassword ? "ตั้งรหัสผ่านชั่วคราว" : "แก้รหัสผ่าน"}</summary><div className="mt-2"><ResetPasswordForm userId={record.id} isTemporary={record.mustChangePassword} /></div></details>
                  </div></details></TableCell>
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
