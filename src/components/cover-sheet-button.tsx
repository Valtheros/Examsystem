"use client";

import { FileText, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CoverSheetButton({ requestRoomId }: { requestRoomId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function generate() {
    setPending(true);
    try {
      const response = await fetch(`/api/cover-sheets/generate/${requestRoomId}`, {
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "สร้างใบปะหน้าไม่สำเร็จ");
      toast.success("สร้างใบปะหน้า PDF แล้ว");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setPending(false);
    }
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={generate} disabled={pending}>
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
      สร้างใบปะหน้า
    </Button>
  );
}
