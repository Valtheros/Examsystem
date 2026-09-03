import { RequestList } from "@/components/request-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { listRequests } from "@/lib/request-queries";
import { requirePageRole } from "@/lib/session";

export default async function ReviewPage() {
  await requirePageRole([ROLES.AV_UNIT]);
  const records = await listRequests({ statuses: [REQUEST_STATUSES.PENDING_REVIEW] });
  return <div className="space-y-7"><div><p className="text-sm font-medium text-primary">หน่วยโสต</p><h1 className="text-3xl font-semibold">ตรวจคำขอ</h1></div><Card><CardHeader><CardTitle>รอตรวจสอบ</CardTitle><CardDescription>ตรวจไฟล์และรายละเอียด หากครบให้รับตัดข้อสอบ หากไม่ครบต้องระบุเหตุผลส่งกลับ</CardDescription></CardHeader><CardContent><RequestList records={records} /></CardContent></Card></div>;
}
