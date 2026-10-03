import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { RequestStatus } from "@/lib/constants";

export type RequestListItem = { id: string; requestNo: string; courseCode: string; courseName: string; groupNo: string; instructorName: string; roundName: string; status: RequestStatus; updatedAt: Date };

export function RequestList({ records }: { records: RequestListItem[] }) {
  return <ul aria-label="รายการคำขอ" className="divide-y">
    {records.map(record=><li key={record.id}><Link href={`/dashboard/requests/${record.id}`} className="group flex items-center gap-4 rounded-lg px-3 py-5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
      <div className="min-w-0 flex-1 space-y-2"><p className="break-words font-semibold group-hover:text-primary">{record.courseCode} {record.courseName}</p><p className="text-sm text-muted-foreground">กลุ่ม {record.groupNo} · {record.instructorName} · {record.roundName}</p><p className="break-all text-xs text-muted-foreground">{record.requestNo} · {record.updatedAt.toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok"})}</p><StatusBadge status={record.status}/></div><ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true"/>
    </Link></li>)}
    {!records.length ? <li className="py-12 text-center text-muted-foreground">ยังไม่มีรายการ</li>:null}
  </ul>;
}
