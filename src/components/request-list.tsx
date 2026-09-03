import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RequestStatus } from "@/lib/constants";

export type RequestListItem = {
  id: string;
  requestNo: string;
  courseCode: string;
  courseName: string;
  groupNo: string;
  instructorName: string;
  roundName: string;
  status: RequestStatus;
  updatedAt: Date;
};

export function RequestList({ records }: { records: RequestListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow><TableHead>เลขที่คำขอ</TableHead><TableHead>รายวิชา</TableHead><TableHead>ผู้ส่ง</TableHead><TableHead>รอบสอบ</TableHead><TableHead>สถานะ</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell><p className="font-medium">{record.requestNo}</p><p className="text-xs text-muted-foreground">แก้ไข {record.updatedAt.toLocaleDateString("th-TH")}</p></TableCell>
              <TableCell><p className="font-medium">{record.courseCode} · กลุ่ม {record.groupNo}</p><p className="text-xs text-muted-foreground">{record.courseName}</p></TableCell>
              <TableCell>{record.instructorName}</TableCell>
              <TableCell>{record.roundName}</TableCell>
              <TableCell><StatusBadge status={record.status} /></TableCell>
              <TableCell><Button asChild size="sm" variant="outline"><Link href={`/dashboard/requests/${record.id}`}>เปิด</Link></Button></TableCell>
            </TableRow>
          ))}
          {!records.length ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">ยังไม่มีรายการ</TableCell></TableRow> : null}
        </TableBody>
      </Table>
    </div>
  );
}
