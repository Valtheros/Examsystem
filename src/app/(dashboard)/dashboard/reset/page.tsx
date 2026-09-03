import { FactoryResetForm } from "@/components/factory-reset-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLES } from "@/lib/constants";
import { requirePageRole } from "@/lib/session";

export default async function ResetPage() {
  await requirePageRole([ROLES.ADMIN]);
  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <div><p className="text-sm font-medium text-destructive">Danger zone</p><h1 className="text-3xl font-semibold">Factory Reset</h1></div>
      <Card className="border-destructive/30"><CardHeader><CardTitle>เริ่มระบบใหม่</CardTitle><CardDescription>ต้องยืนยันด้วยรหัสผ่านปัจจุบันและข้อความที่กำหนด ระบบไม่มี automatic backup ตามขอบเขตที่ตกลงไว้</CardDescription></CardHeader><CardContent><FactoryResetForm /></CardContent></Card>
    </div>
  );
}
