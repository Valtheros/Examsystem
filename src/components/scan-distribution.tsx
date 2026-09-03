"use client";

import { CheckCircle2, LoaderCircle, ScanLine } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ScanDistribution({ token, completed }: { token: string; completed: boolean }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(completed);
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/distributions/scan/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: formData.get("note") }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "บันทึกไม่สำเร็จ");
      setDone(true);
      setMessage("บันทึกการแจกจ่ายเข้าห้องสอบแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <Alert><CheckCircle2 className="size-4" /><AlertDescription>{message || "ห้องสอบนี้บันทึกการแจกจ่ายแล้ว"}</AlertDescription></Alert>;
  }
  return (
    <form action={submit} className="space-y-4">
      {message ? <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert> : null}
      <div className="space-y-2"><Label htmlFor="note">หมายเหตุ (ถ้ามี)</Label><Textarea id="note" name="note" /></div>
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
        {pending ? "กำลังบันทึก..." : "ยืนยันแจกข้อสอบให้ห้องนี้"}
      </Button>
    </form>
  );
}
