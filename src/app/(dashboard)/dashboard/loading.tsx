import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return <div role="status" aria-label="กำลังโหลดข้อมูล" className="space-y-8">
    <span className="sr-only">กำลังโหลดข้อมูล กรุณารอสักครู่</span>
    <div className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-2/3 max-w-96" /><Skeleton className="h-4 w-3/4" /></div>
    <div className="divide-y border-y">{[1, 2, 3].map(item => <div key={item} className="space-y-3 py-6"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /></div>)}</div>
  </div>;
}
