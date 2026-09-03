"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_EXAM_FILE_BYTES } from "@/lib/constants";

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function FileUpload({
  requestId,
  kind,
}: {
  requestId: string;
  kind: "ต้นฉบับ" | "พร้อมพิมพ์";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("อนุญาตเฉพาะไฟล์ PDF");
      return;
    }
    if (file.size > MAX_EXAM_FILE_BYTES) {
      toast.error("ไฟล์ต้องมีขนาดไม่เกิน 100 MB");
      return;
    }

    setPending(true);
    try {
      const checksum = await sha256(file);
      const metadata = {
        requestId,
        fileName: file.name,
        fileSize: file.size,
        contentType: "application/pdf" as const,
        sha256: checksum,
        kind,
      };
      const signedResponse = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(metadata),
      });
      const signed = (await signedResponse.json()) as {
        ok: boolean;
        message?: string;
        url?: string;
        storageKey?: string;
        headers?: Record<string, string>;
      };
      if (!signedResponse.ok || !signed.url || !signed.storageKey) {
        throw new Error(signed.message || "สร้าง URL อัปโหลดไม่สำเร็จ");
      }
      const putResponse = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: file,
      });
      if (!putResponse.ok) throw new Error("ส่งไฟล์ไป Storage ไม่สำเร็จ");

      const completeResponse = await fetch("/api/files/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...metadata, storageKey: signed.storageKey }),
      });
      const completed = (await completeResponse.json()) as { ok: boolean; message?: string };
      if (!completeResponse.ok) throw new Error(completed.message || "ยืนยันไฟล์ไม่สำเร็จ");
      toast.success("อัปโหลดไฟล์เรียบร้อย");
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={upload} className="space-y-3">
      <Label htmlFor={`file-${kind}`}>{kind === "ต้นฉบับ" ? "ไฟล์ข้อสอบ PDF" : "ไฟล์พร้อมพิมพ์ PDF"}</Label>
      <Input id={`file-${kind}`} name="file" type="file" accept="application/pdf,.pdf" required disabled={pending} />
      <p className="text-xs text-muted-foreground">สูงสุด 100 MB ระบบคำนวณ SHA-256 ก่อนอัปโหลดตรงไปยัง Private Storage</p>
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
        {pending ? "กำลังตรวจและอัปโหลด..." : "อัปโหลดไฟล์"}
      </Button>
    </form>
  );
}
