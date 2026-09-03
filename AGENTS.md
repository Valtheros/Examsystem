# AGENTS.md

## Project Context

โปรเจกต์นี้คือ **ระบบจัดพิมพ์ข้อสอบ คณะวิทยาศาสตร์** ดูแลตั้งแต่สร้างรอบสอบ ส่งต้นฉบับ ตรวจ/ตัดข้อสอบ พิมพ์ ส่งมอบ และแจกจ่ายเข้าห้องสอบ แหล่งอ้างอิงหลักคือ `docs/REQUIREMENTS.md`, `docs/DATA_DICTIONARY.md` และ schema ใน `src/db/schema` หากขัดกันให้ยึดคำสั่งล่าสุดของผู้ใช้ แล้วปรับเอกสาร schema authorization และ UI ให้ตรงกัน

## Technology

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui, npm, Node.js 22
- Supabase PostgreSQL เท่านั้น ไม่ใช้ Supabase Auth หรือ Supabase Storage
- Drizzle ORM; Docker runtime ใช้ `DATABASE_URL` ของ Supavisor Session pooler และ migration ใช้ `DIRECT_DATABASE_URL`
- Better Auth อยู่ schema `better_auth`; ข้อมูลธุรกิจอยู่ schema `app`
- MinIO private bucket บนเครื่องเซิร์ฟเวอร์ผ่าน S3 API; browser อัปโหลดตรงด้วย Presigned PUT
- Next.js, MinIO และ Caddy รันด้วย Docker Compose; Caddy ออก HTTPS ให้โดเมนเว็บและโดเมนไฟล์
- Nodemailer ใช้ Gmail OAuth2 บน production และ Mailpit สำหรับ local
- ไม่ใช้ Vercel, Cloudflare R2 หรือ PostgreSQL container ใน production; `compose.yaml` มี PostgreSQL เฉพาะ local development

## Canonical Roles

ใช้ชื่อเหล่านี้ใน DB, code, UI และเอกสารเท่านั้น:

- `ผู้ดูแลระบบ` — สร้าง/จัดการผู้ใช้ Audit Log และ Factory Reset
- `เจ้าหน้าที่` — รอบสอบ รายวิชา ห้อง รับมอบ และแจกจ่าย
- `อาจารย์` — คำขอและไฟล์เฉพาะรายวิชาตนเอง
- `หน่วยโสต` — ตรวจ ตัด เตรียมไฟล์/ใบปะหน้า พิมพ์ และส่งมอบ

ไม่มี self-registration ผู้ดูแลระบบสร้างบัญชีอื่นทั้งหมด ห้ามใช้ชื่อบทบาทเก่าใน UI

## Workflow

`ฉบับร่าง → รอตรวจสอบ → ตัดข้อสอบ → กำลังพิมพ์ → พิมพ์เสร็จแล้ว → ส่งมอบแล้ว`

เส้นทางแก้ไข: `รอตรวจสอบ → ปฏิเสธ/ส่งกลับแก้ไข → รอตรวจสอบ`

- อาจารย์ส่งต้นฉบับกระดาษ 1 ชุดพร้อมแบบฟอร์ม ขณะที่จำนวนพิมพ์ต่อห้อง = ผู้เข้าสอบ + สำรอง 1 ชุด
- คำขอแก้ไขและเปลี่ยนไฟล์ได้เฉพาะ `ฉบับร่าง` หรือ `ปฏิเสธ/ส่งกลับแก้ไข`
- ยกเลิกแบบ Soft Delete ได้ก่อน `ตัดข้อสอบ`; ไม่เพิ่มสถานะยกเลิก
- ทุก transition ต้องตรวจ source status ใน transaction เดียวและเพิ่ม `request_status_history` กับ `audit_logs`
- `exam_rooms` เป็นตารางกลาง Subject–Room และ `request_rooms` เป็น snapshot รายห้องสำหรับคำขอ/ใบปะหน้า

## Security Rules

- ทุก Server Action/Route Handler ตรวจ session, role, ownership และ request status ฝั่ง server
- ห้ามเก็บ password ปกติ; Better Auth เก็บ hash ใน `better_auth.accounts`
- รหัสผ่านอย่างน้อย 12 ตัวอักษรและบังคับเปลี่ยนรหัสผ่านชั่วคราวครั้งแรก รุ่นนี้ไม่มี 2FA
- อนุญาต PDF สูงสุด 100 MB; ตรวจ extension, MIME, `%PDF-`, size, SHA-256 และ random object key
- Upload URL อายุ 5 นาที; Download URL อายุ 1 นาที; MinIO bucket ต้อง private
- หน่วยโสตดาวน์โหลดข้อสอบได้เฉพาะช่วง `ตัดข้อสอบ` ถึง `พิมพ์เสร็จแล้ว`; เจ้าหน้าที่ไม่มีสิทธิ์ดาวน์โหลดไฟล์ข้อสอบ
- Audit Log เก็บ actor username/role snapshot เพื่ออ่านได้หลังลบบัญชี
- Notification ไม่มี read state เก็บเฉพาะ `Pending/Sent/Failed`; การส่งอีเมลล้มเหลวต้องไม่ rollback งานหลัก
- เวลาเก็บเป็น UTC และแสดง `Asia/Bangkok`

## Factory Reset

เฉพาะผู้ดูแลระบบ ต้องยืนยันรหัสผ่านและพิมพ์ `RESET EXAM SYSTEM` เก็บเฉพาะบัญชีผู้ดูแลที่กดกับ Audit Log ลบข้อมูลอื่นและ MinIO ทั้งหมด หากลบไฟล์ไม่ครบให้ฐานข้อมูลยังคงถูกรีเซ็ตและเปิดให้ retry เฉพาะ Storage ระบบไม่มี automatic backup และกู้ reset ไม่ได้

## Environment

ห้าม commit `.env`, secret หรือไฟล์ข้อสอบ ดูรายการตัวแปรที่ `docs/SETUP.md`, `.env.example` และ `.env.docker.example` ห้ามนำ MinIO/Gmail/Database secret ไปไว้ในตัวแปรที่ขึ้นต้น `NEXT_PUBLIC_`

## Verification

หลังแก้โค้ด ให้รันแคบที่สุดก่อน:

- `npm run lint`
- `npm run test`
- `npm run build` เมื่อแก้โครงสร้าง การ render, TypeScript, imports, package หรือ production behavior

เมื่อมีฐานข้อมูลทดสอบ ให้รัน migration/integration และเมื่อมี credentials ครบให้รัน Playwright กับ workflow 4 บทบาท รุ่นนี้ไม่กำหนดเกณฑ์ concurrent users จนกว่าจะทราบสเปกเครื่องเซิร์ฟเวอร์จริง

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
