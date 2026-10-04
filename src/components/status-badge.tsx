import { Badge } from "@/components/ui/badge";
import { LEGACY_DELIVERED_STATUS, REQUEST_STATUSES, type RequestStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const statusClass: Record<RequestStatus, string> = {
  [REQUEST_STATUSES.DRAFT]: "bg-muted text-muted-foreground border-border",
  [REQUEST_STATUSES.PENDING_REVIEW]: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
  [REQUEST_STATUSES.RETURNED]: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
  [REQUEST_STATUSES.CUTTING]: "bg-secondary text-secondary-foreground border-border",
  [REQUEST_STATUSES.PRINTING]: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
  [REQUEST_STATUSES.PRINTED]: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  [LEGACY_DELIVERED_STATUS]: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", statusClass[status])}>
      {status}
    </Badge>
  );
}
