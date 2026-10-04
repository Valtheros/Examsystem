# AGENTS.md

## Project Context

โปรเจกต์นี้คือ **ระบบจัดพิมพ์ข้อสอบ คณะวิทยาศาสตร์** ดูแลตั้งแต่สร้างรอบสอบ ส่งต้นฉบับ ตรวจ/ตัดข้อสอบ จนพิมพ์เสร็จพร้อมใบปะหน้าซอง แหล่งอ้างอิงหลักคือ `docs/REQUIREMENTS.md`, `docs/DATA_DICTIONARY.md` และ schema ใน `src/db/schema` หากขัดกันให้ยึดคำสั่งล่าสุดของผู้ใช้ แล้วปรับเอกสาร schema authorization และ UI ให้ตรงกัน

## Technology

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui, npm, Node.js 22
- PostgreSQL 17 รันใน Docker และเก็บข้อมูลใน named volume เดิม (`examsystem_postgres` ใน compose.yaml; `postgres_data` ใน production Compose)
- Drizzle ORM; production Compose สร้าง `DATABASE_URL` ภายในเครือข่าย Docker จาก `POSTGRES_*`
- Better Auth อยู่ schema `better_auth`; ข้อมูลธุรกิจอยู่ schema `app`
- MinIO private bucket บนเครื่องเซิร์ฟเวอร์ผ่าน S3 API; browser อัปโหลดตรงด้วย Presigned PUT
- Next.js, PostgreSQL, MinIO และ Caddy รันด้วย Docker Compose; Caddy ออก HTTPS ให้โดเมนเว็บและโดเมนไฟล์
- Nodemailer ใช้ Gmail OAuth2 บน production และ Mailpit สำหรับ local
- ไม่ใช้ Supabase, Vercel หรือ Cloudflare R2 ใน production; ฐานข้อมูลและไฟล์อยู่บนเครื่องเซิร์ฟเวอร์ที่รัน Docker

## Canonical Roles

ใช้ชื่อเหล่านี้ใน DB, code, UI และเอกสารเท่านั้น:

- `ผู้ดูแลระบบ` — สร้าง/จัดการผู้ใช้ Audit Log และ Factory Reset
- `เจ้าหน้าที่` — รอบสอบ รายวิชา ห้อง และตารางสอบ
- `อาจารย์` — คำขอและไฟล์เฉพาะรายวิชาตนเอง
- `หน่วยโสต` — ตรวจ ตัด เตรียมไฟล์/ใบปะหน้า พิมพ์ และยืนยันพิมพ์เสร็จ

ไม่มี self-registration ผู้ดูแลระบบสร้างบัญชีอื่นทั้งหมด ห้ามใช้ชื่อบทบาทเก่าใน UI

## Workflow

`ฉบับร่าง → รอตรวจสอบ → ตัดข้อสอบ → กำลังพิมพ์ → พิมพ์เสร็จแล้ว`

ตั้งแต่ 3 ตุลาคม 2569: เจ้าหน้าที่เลือกรอบ กลางภาค/ปลายภาค/รอบสอบอื่น (กรอกเอง) งานจบเมื่อหน่วยโสตยืนยันพิมพ์เสร็จ ไม่มีเมนูรับมอบ/แจกจ่าย ไม่มี QR หรือ API สแกน การนำซองไปส่งเจ้าหน้าที่ทำภายนอกระบบ ใบปะหน้าใช้แบบฟอร์ม PSU และโลโก้ public/images.png ช่องวันสอบจริงและลายเซ็นเว้นว่าง สถานะ ส่งมอบแล้ว และ qr_token คงไว้สำหรับความเข้ากันได้กับข้อมูลเดิม ไม่ใช้ในงานใหม่ Migration 0005 ย้ายประวัติ deliveries/distributions (ถ้ามี) เข้า audit_logs แล้วลบสองตารางที่เลิกใช้ ไม่ลบคำขอ ไฟล์ งานพิมพ์ หรือประวัติอื่น

ฐานข้อมูลปัจจุบันมี 16 ตารางของระบบ: better_auth 4 ตาราง และ app 12 ตาราง ไม่สร้าง deliveries/distributions กลับมา ไม่แก้ migration 0000–0004 ย้อนหลัง ตาราง drizzle.__drizzle_migrations เป็น metadata ที่ migrator ต้องใช้ ห้ามลบเพื่อให้จำนวนตารางดูน้อยลง

เส้นทางแก้ไข: `รอตรวจสอบ → ปฏิเสธ/ส่งกลับแก้ไข → รอตรวจสอบ`

- เจ้าหน้าที่กำหนดห้อง ความจุ และตารางสอบ ไม่กำหนดจำนวนข้อสอบ; ล็อกวิชา/ตารางเมื่อมีคำขอที่ไม่ยกเลิก และ serialize การจองห้องป้องกันเวลาทับซ้อน
- อาจารย์ส่งแบบฟอร์มออนไลน์ (`submission_form`) และ PDF ผ่าน wizard 3 ขั้นตอน ไม่มีต้นฉบับกระดาษ กรอกจำนวนชุดต่อห้อง > 0 ไม่เกินความจุ โดย 1 ชุดต่อผู้เข้าสอบ 1 คน
- `request_rooms.student_count` คือยอดอาจารย์; `base_copy_count` คือยอดหลักหน่วยโสต (เริ่มจากยอดอาจารย์) + `reserve_count` (เริ่ม 1 แก้เป็น 0 ขึ้นไปได้) = `print_count` ห้ามเขียนทับยอดอาจารย์เมื่อปรับพิมพ์ และต้องระบุเหตุผลเมื่อปรับยอดหลัก
- รับงานแล้วสร้าง `print_jobs` รอพิมพ์ เลือกต้นฉบับล่าสุดได้ทันที; ไฟล์พร้อมพิมพ์เป็นทางเลือก ยืนยันแผนก่อนสร้างใบปะหน้า ทุกการเปลี่ยนไฟล์/จำนวนเพิ่ม revision และต้องสร้าง covers รุ่นปัจจุบันก่อนเริ่มพิมพ์
- ล็อกแผนเมื่อเริ่มพิมพ์ เก็บไฟล์และใบปะหน้าทุกรุ่น แม้ยกเลิกคำขอ; ส่วนเข้าสอบจริง/ขาดสอบ/ลายเซ็นบนใบปะหน้าเป็นช่องว่างสำหรับเขียน ไม่ใช่ข้อมูลใน DB
- คำขอแก้ไขและเปลี่ยนไฟล์ได้เฉพาะ `ฉบับร่าง` หรือ `ปฏิเสธ/ส่งกลับแก้ไข`
- ยกเลิกแบบ Soft Delete ได้ก่อน `ตัดข้อสอบ`; ไม่เพิ่มสถานะยกเลิก
- ทุก transition ต้องตรวจ source status ใน transaction เดียวและเพิ่ม `request_status_history` กับ `audit_logs`
- `exam_rooms` เป็นตารางกลาง Subject–Room และ `request_rooms` เป็น snapshot รายห้องสำหรับคำขอ/ใบปะหน้า

## Security Rules

- ผู้ดูแลระบบใช้ Better Auth impersonation จากหน้าผู้ใช้ได้เฉพาะบัญชี non-admin ที่เปิดใช้งานและเปลี่ยนรหัสผ่านครั้งแรกแล้ว มีแถบแจ้งเตือน/ปุ่มกลับบัญชีเดิมทุกหน้า อายุ session 1 ชั่วโมง และ audit เหตุการณ์เริ่ม/จบ ห้ามเปลี่ยนรหัสผ่านของผู้ใช้เพื่อเข้าใช้งานแทน

- ทุก Server Action/Route Handler ตรวจ session, role, ownership และ request status ฝั่ง server
- ห้ามเก็บ password ปกติ; Better Auth เก็บ hash ใน `better_auth.accounts`
- รหัสผ่านอย่างน้อย 12 ตัวอักษรและบังคับเปลี่ยนรหัสผ่านชั่วคราวครั้งแรก รุ่นนี้ไม่มี 2FA
- อนุญาต PDF สูงสุด 100 MB; ตรวจ extension, MIME, `%PDF-`, size, SHA-256 และ random object key
- Upload URL อายุ 5 นาที; Download URL อายุ 1 นาที; MinIO bucket ต้อง private
- หน่วยโสตดาวน์โหลดข้อสอบได้ตั้งแต่ `รอตรวจสอบ` เพื่อใช้ตรวจคำขอ และช่วง `ตัดข้อสอบ` ถึง `พิมพ์เสร็จแล้ว`; เจ้าหน้าที่ไม่มีสิทธิ์ดาวน์โหลดไฟล์ข้อสอบ
- Audit Log เก็บ actor username/role snapshot เพื่ออ่านได้หลังลบบัญชี
- Notification ไม่มี read state เก็บเฉพาะ `Pending/Sent/Failed`; การส่งอีเมลล้มเหลวต้องไม่ rollback งานหลัก
- เวลาเก็บเป็น UTC และแสดง `Asia/Bangkok`

## Factory Reset

เฉพาะผู้ดูแลระบบ ต้องยืนยันรหัสผ่านและพิมพ์ `RESET EXAM SYSTEM` เก็บเฉพาะบัญชีผู้ดูแลที่กดกับ Audit Log ลบข้อมูลอื่นและ MinIO ทั้งหมด หากลบไฟล์ไม่ครบให้ฐานข้อมูลยังคงถูกรีเซ็ตและเปิดให้ retry เฉพาะ Storage ระบบไม่มี automatic backup และกู้ reset ไม่ได้

## Environment

ห้าม commit `.env`, secret หรือไฟล์ข้อสอบ ดูรายการตัวแปรที่ `docs/SETUP.md`, `.env.example` และ `.env.docker.example` ห้ามนำ MinIO/Gmail/Database secret ไปไว้ในตัวแปรที่ขึ้นต้น `NEXT_PUBLIC_`

## Verification

ผลและวิธีทดสอบด้าน UI/workflow ล่าสุดอยู่ที่ `docs/UI_REVIEW.md` ห้ามใส่บัญชี `review.*` หรือรหัสผ่านทดสอบใน production และอย่าปิด rate limit เพื่อทำให้ E2E ผ่าน

หลังแก้โค้ด ให้รันแคบที่สุดก่อน:

- `npm run lint`
- `npm run test`
- `npm run build` เมื่อแก้โครงสร้าง การ render, TypeScript, imports, package หรือ production behavior

เมื่อมีฐานข้อมูลทดสอบ ให้รัน migration/integration และเมื่อมี credentials ครบให้รัน Playwright กับ workflow 4 บทบาท รุ่นนี้ไม่กำหนดเกณฑ์ concurrent users จนกว่าจะทราบสเปกเครื่องเซิร์ฟเวอร์จริง

## UI feedback

คำสั่งล่าสุด: ส่วน Brand ใต้โลโก้/ชื่อระบบไม่แสดงบรรทัด “คณะวิทยาศาสตร์” ทุกหน้า รวม sidebar และเมนูมือถือ ไม่เปลี่ยนชื่อคณะบนใบปะหน้าซองหรือเอกสารของระบบ

Visual redesign ล่าสุด 3 ตุลาคม 2569: ใช้ PSU navy, โลโก้เว็บ public/psu-logo-transparent.png (เก็บ public/images.png ต้นฉบับสำหรับ PDF), Noto Sans Thai, โหมดสว่างเริ่มต้นและ next-themes สำหรับสลับมืด Card default เป็น section เส้นแบ่งเรียบ ห้ามกลับไปใช้การ์ดสถิติ/กรอบโค้งซ้อนจำนวนมาก หน้าหลักใช้ task rows และทุกหน้างานอ่านบนลงล่าง รายละเอียดอยู่ docs/UX_GUIDELINES.md เครื่องมือดูฐานข้อมูลคือ `npm run db:studio` + https://local.drizzle.studio เฉพาะในเครื่อง ไม่ใช้ Adminer หรือ Prisma Studio และไม่เปิดต่ออินเทอร์เน็ต

ใช้ `docs/UX_GUIDELINES.md` เป็นเกณฑ์ออกแบบ: หน้าทำงานเรียงคอลัมน์เดียวบนลงล่าง งานปัจจุบันก่อนประวัติ มีปุ่มหลักตามขั้นที่พร้อม ไม่วางปุ่มดำเนินการด้านข้างและไม่แสดงปุ่มขั้นเก่าซ้ำ หน้ารายการคำขอใช้ลิงก์ทั้งแถว รองรับคีย์บอร์ด ไม่เพิ่มปุ่ม เปิด แยกต่อรายการ

ห้ามใช้ native browser `alert`, `confirm` หรือ `prompt` ในโค้ดแอป ใช้ shadcn AlertDialog สำหรับยืนยันการกระทำ, Sonner toast สำหรับผลสำเร็จ/ข้อผิดพลาดระยะสั้น และ shadcn Alert สำหรับ validation หรือคำเตือนที่ต้องคงไว้บนหน้า ระหว่างส่งคำขอต้องป้องกันกดซ้ำ กล่องยืนยันต้องยกเลิกได้ก่อนเริ่มงาน การทดสอบ UI Factory Reset ให้ mock endpoint ห้ามล้างฐานข้อมูลจริงโดยไม่ตั้งใจ

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
