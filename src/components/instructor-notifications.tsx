"use client";

import { Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/status-badge";
import { BANGKOK_TIME_ZONE } from "@/lib/constants";
import type { InstructorNotification } from "@/lib/notification-types";

const NotificationContext = createContext<{ records: InstructorNotification[]; error: string | null } | null>(null);
const formatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: BANGKOK_TIME_ZONE });

export function InstructorNotificationsProvider({ userId, initialNotifications, children }: { userId: string; initialNotifications: InstructorNotification[]; children?: ReactNode }) {
  const [records, setRecords] = useState(initialNotifications);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef(new Set(initialNotifications.map(record => record.id)));
  const router = useRouter();
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function poll() {
      if (disposed || document.hidden || controller) return;
      const currentController = new AbortController();
      controller = currentController;
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", signal: currentController.signal });
        if (response.status === 401 || response.status === 403) {
          if (!disposed) { setRecords([]); setError("กรุณาเข้าสู่ระบบอีกครั้งเพื่อดูการแจ้งเตือน"); }
          return;
        }
        if (!response.ok) throw new Error("NOTIFICATION_FETCH_FAILED");
        const result = await response.json() as { notifications: InstructorNotification[] };
        if (!Array.isArray(result.notifications)) throw new Error("INVALID_NOTIFICATION_RESPONSE");
        if (disposed || currentController.signal.aborted) return;
        const fresh = result.notifications.filter(record => !seenIds.current.has(record.id));
        result.notifications.forEach(record => seenIds.current.add(record.id));
        setRecords(result.notifications);
        setError(null);
        if (fresh.length) {
          const latest = fresh[0];
          const notify = latest.status === "ปฏิเสธ/ส่งกลับแก้ไข" ? toast.warning : latest.status === "พิมพ์เสร็จแล้ว" ? toast.success : toast.info;
          notify(fresh.length > 1 ? `มีการอัปเดตข้อสอบ ${fresh.length} รายการ` : "ข้อสอบของคุณมีการอัปเดต", {
            id: `instructor-notification-${userId}-${latest.id}`,
            description: `${latest.courseCode} ${latest.courseName} — ${latest.status}`,
            action: { label: "ดูคำขอ", onClick: () => router.push(`/dashboard/requests/${latest.requestId}`) },
          });
        }
      } catch {
        if (!disposed && !currentController.signal.aborted) setError("ยังตรวจการอัปเดตใหม่ไม่ได้ ระบบจะลองอีกครั้งโดยเก็บรายการเดิมไว้");
      } finally {
        if (controller === currentController) controller = null;
      }
    }
    function visibilityChanged() {
      clearInterval(timer);
      if (document.hidden) { controller?.abort(); controller = null; }
      else { void poll(); timer = setInterval(() => void poll(), 30000); }
    }
    visibilityChanged();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); document.removeEventListener("visibilitychange", visibilityChanged); };
  }, [router, userId]);
  return <NotificationContext.Provider value={{ records, error }}>{children}</NotificationContext.Provider>;
}

function NotificationRows({ records, onNavigate }: { records: InstructorNotification[]; onNavigate?: () => void }) {
  return <ul className="divide-y">{records.map(record => <li key={record.id}>
    <Link href={`/dashboard/requests/${record.requestId}`} onClick={onNavigate} className="group flex min-h-11 items-start gap-3 py-4 focus-visible:outline-2 focus-visible:outline-ring hover:text-primary">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="break-words font-semibold">{record.courseCode} {record.courseName}</p>
        <StatusBadge status={record.status} />
        {record.status === "ตัดข้อสอบ" ? <p className="text-sm text-muted-foreground">หน่วยโสตรับงานแล้วและกำลังเตรียมพิมพ์</p> : null}
        {record.reason ? <p className="whitespace-pre-wrap break-words text-sm">เหตุผล: {record.reason}</p> : null}
        <p className="break-words text-xs text-muted-foreground">{record.requestNo} · <time dateTime={record.createdAt}>{formatter.format(new Date(record.createdAt))}</time></p>
      </div>
      <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
    </Link>
  </li>)}</ul>;
}

export function InstructorNotificationBell() {
  const context = useContext(NotificationContext);
  const [open, setOpen] = useState(false);
  if (!context) return null;
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button variant="outline" size="icon" aria-label="การแจ้งเตือนข้อสอบ" title="การแจ้งเตือนข้อสอบ"><Bell aria-hidden="true" className="size-5" /></Button></SheetTrigger>
    <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-[calc(100vw-1rem)] data-[side=right]:sm:max-w-lg">
      <SheetHeader className="border-b px-5 py-6 pr-16"><SheetTitle>การแจ้งเตือนข้อสอบ</SheetTitle><SheetDescription>การอัปเดตล่าสุดของคุณ สูงสุด 50 รายการ</SheetDescription></SheetHeader>
      <div className="px-5">
        {context.error ? <p role="status" className="py-4 text-sm text-destructive">{context.error}</p> : null}
        {context.records.length ? <NotificationRows records={context.records} onNavigate={() => setOpen(false)} /> : <p className="py-10 text-center text-muted-foreground">ยังไม่มีการอัปเดตจากหน่วยโสต</p>}
      </div>
    </SheetContent>
  </Sheet>;
}

export function InstructorNotificationSummary() {
  const context = useContext(NotificationContext);
  if (!context) return null;
  return <section aria-labelledby="latest-exam-updates" className="rounded-lg border-l-4 border-primary bg-feature px-5 py-4 text-feature-foreground sm:px-6">
    <h2 id="latest-exam-updates" className="flex items-center gap-2 text-lg font-semibold"><Bell aria-hidden="true" className="size-5" /> การอัปเดตข้อสอบล่าสุด</h2>
    {context.error ? <p role="status" className="mt-3 text-sm text-destructive">{context.error}</p> : null}
    {context.records.length ? <NotificationRows records={context.records.slice(0, 3)} /> : <p className="mt-3 text-sm text-muted-foreground">การอัปเดตสถานะจะแสดงที่นี่ และส่งอีเมลให้คุณเฉพาะเมื่อพิมพ์เสร็จแล้ว</p>}
  </section>;
}
