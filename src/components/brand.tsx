import Image from "next/image";

export function Brand() {
  return <div className="flex min-w-0 items-center gap-3"><Image src="/psu-logo-transparent.png" alt="ตรามหาวิทยาลัยสงขลานครินทร์" width={44} height={56} className="h-14 w-11 shrink-0 object-contain" /><p className="text-sm font-semibold leading-6">ระบบจัดพิมพ์ข้อสอบ</p></div>;
}
