import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const statusClass: Record<RequestStatus, string> = {
  [REQUEST_STATUSES.DRAFT]: "bg-slate-100 text-slate-700 border-slate-200",
  [REQUEST_STATUSES.PENDING_REVIEW]: "bg-amber-50 text-amber-800 border-amber-200",
  [REQUEST_STATUSES.RETURNED]: "bg-red-50 text-red-700 border-red-200",
  [REQUEST_STATUSES.CUTTING]: "bg-violet-50 text-violet-700 border-violet-200",
  [REQUEST_STATUSES.PRINTING]: "bg-blue-50 text-blue-700 border-blue-200",
  [REQUEST_STATUSES.PRINTED]: "bg-cyan-50 text-cyan-800 border-cyan-200",
  [REQUEST_STATUSES.DELIVERED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", statusClass[status])}>
      {status}
    </Badge>
  );
}
