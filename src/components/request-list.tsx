import Link from "next/link";
import { ChevronRight, FileText, FolderOpen } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { RequestStatus } from "@/lib/constants";

export type RequestListItem = { id: string; requestNo: string; courseCode: string; courseName: string; groupNo: string; instructorName: string; roundName: string; status: RequestStatus; updatedAt: Date };

export function RequestList({ records }: { records: RequestListItem[] }) {
  return (
    <ul aria-label="รายการคำขอ" className="divide-y">
      {records.map((record) => (
        <li key={record.id}>
          <Link
            href={`/dashboard/requests/${record.id}`}
            className="group flex items-start gap-3 px-3 py-5 transition-colors hover:bg-feature/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:items-center sm:gap-4 sm:px-4 sm:py-6"
          >
            <FileText className="mt-1 hidden size-6 shrink-0 text-primary/75 sm:block" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between md:gap-5">
                <div className="min-w-0">
                  <p className="mb-1 break-all text-xs font-medium tracking-wide text-muted-foreground">{record.requestNo}</p>
                  <p className="break-words text-base font-semibold leading-relaxed group-hover:text-primary">
                    <span className="text-primary">{record.courseCode}</span> {record.courseName}
                  </p>
                </div>
                <div className="shrink-0"><StatusBadge status={record.status} /></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="min-w-0 max-w-full break-words">กลุ่ม {record.groupNo} · {record.roundName}</span>
                <span className="min-w-0 max-w-full break-words">{record.instructorName}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                อัปเดต {record.updatedAt.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <ChevronRight className="mt-7 size-5 shrink-0 text-muted-foreground group-hover:text-primary motion-safe:transition-transform motion-safe:group-hover:translate-x-1 sm:mt-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
      {!records.length ? (
        <li className="flex flex-col items-center px-5 py-12 text-center">
          <FolderOpen className="mb-4 size-9 text-primary/65" aria-hidden="true" />
          <p className="font-medium">ยังไม่มีรายการ</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">คำขอที่คุณมีสิทธิ์ดูจะแสดงที่นี่ หากเลือกตัวกรองไว้ ลองปรับตัวกรองอีกครั้ง</p>
        </li>
      ) : null}
    </ul>
  );
}
