import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RequestNotFound() {
  return <section className="max-w-xl space-y-5 py-8"><h1 className="text-2xl font-semibold">ไม่พบคำขอที่คุณเข้าถึงได้</h1><p className="text-muted-foreground">คำขออาจไม่มีอยู่ หรือบัญชีของคุณไม่มีสิทธิ์ดูรายการนี้</p><Button asChild><Link href="/dashboard/requests">กลับไปคำขอทั้งหมด</Link></Button></section>;
}
