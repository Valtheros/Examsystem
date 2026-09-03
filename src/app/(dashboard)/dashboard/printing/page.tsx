import { RequestList } from "@/components/request-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import { listRequests } from "@/lib/request-queries";
import { requirePageRole } from "@/lib/session";

export default async function PrintingPage() {
  await requirePageRole([ROLES.AV_UNIT]);
  const records = await listRequests({ statuses: [REQUEST_STATUSES.CUTTING, REQUEST_STATUSES.PRINTING, REQUEST_STATUSES.PRINTED] });
  return <div className="space-y-7"><div><p className="text-sm font-medium text-primary">หน่วยโสต</p><h1 className="text-3xl font-semibold">งานพิมพ์</h1></div><Card><CardHeader><CardTitle>คิวตัดและพิมพ์</CardTitle><CardDescription>ก่อนเริ่มพิมพ์ต้องมีไฟล์พร้อมพิมพ์และใบปะหน้าครบทุกห้อง</CardDescription></CardHeader><CardContent><RequestList records={records} /></CardContent></Card></div>;
}
