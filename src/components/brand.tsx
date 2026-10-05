import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({ appearance = "default" }: { appearance?: "default" | "sidebar" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", appearance === "sidebar" && "text-sidebar-foreground")}>
      <span className={cn("flex shrink-0 items-center justify-center", appearance === "sidebar" && "h-16 w-12 rounded-lg bg-white/95 px-1 py-1.5")}>
        <Image
          src="/psu-logo-transparent.png"
          alt="ตรามหาวิทยาลัยสงขลานครินทร์"
          width={44}
          height={56}
          className={cn("h-14 w-11 shrink-0 object-contain", appearance === "sidebar" && "h-12 w-9")}
        />
      </span>
      <p className="text-sm font-semibold leading-6">ระบบจัดพิมพ์ข้อสอบ</p>
    </div>
  );
}
