"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function RetryEmailButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function retry() {
    setPending(true);
    try {
      const response = await fetch(`/api/admin/notifications/${id}/retry`, { method: "POST" });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.message || result.error || "ส่งไม่สำเร็จ");
      toast.success("ส่งอีเมลสำเร็จ");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ส่งไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }
  return <Button type="button" size="sm" variant="outline" onClick={retry} disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} ส่งใหม่</Button>;
}
