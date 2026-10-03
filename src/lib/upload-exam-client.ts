import { MAX_EXAM_FILE_BYTES } from "./constants";
export async function uploadExamFile(requestId: string, file: File, kind: "ต้นฉบับ" | "พร้อมพิมพ์", progress: (value: number) => void = () => {}) {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf" || file.size < 1 || file.size > MAX_EXAM_FILE_BYTES) throw new Error("กรุณาเลือก PDF ขนาดไม่เกิน 100 MB");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const metadata = { requestId, fileName: file.name, fileSize: file.size, contentType: "application/pdf", sha256, kind };
  const response = await fetch("/api/files/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(metadata) });
  const signed = await response.json();
  if (!response.ok || !signed.url || !signed.storageKey) throw new Error(signed.message || "สร้าง URL อัปโหลดไม่สำเร็จ");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open("PUT", signed.url);
    for (const [key, value] of Object.entries(signed.headers || {})) xhr.setRequestHeader(key, String(value));
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 95)); };
    xhr.onerror = () => reject(new Error("ส่งไฟล์ไม่สำเร็จ กรุณาลองใหม่ ข้อมูลแบบฟอร์มยังอยู่"));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Storage ไม่รับไฟล์ กรุณาลองใหม่"));
    xhr.send(file);
  });
  const completed = await fetch("/api/files/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...metadata, storageKey: signed.storageKey }) });
  const result = await completed.json();
  if (!completed.ok) throw new Error(result.message || "ยืนยันไฟล์ไม่สำเร็จ กรุณาลองใหม่");
  progress(100);
  return result.file as { id: string; originalFileName: string; version: number };
}
