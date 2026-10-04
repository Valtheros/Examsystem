# Data Dictionary — ระบบจัดพิมพ์ข้อสอบ

เอกสารนี้ตรงกับ Drizzle schema และ migration ปัจจุบัน ฐานข้อมูลเป็น PostgreSQL มี 16 ตารางของระบบใน 2 schema (`better_auth` 4 / `app` 12) เวลาใช้ `TIMESTAMPTZ` เก็บเป็น UTC และแปลงเป็น `Asia/Bangkok` ตอนแสดงผล ตารางภายใน `drizzle.__drizzle_migrations` ใช้ติดตาม migration ต้องเก็บไว้และไม่นับรวมใน 16 ตารางนี้

สัญลักษณ์: PK = Primary Key, FK = Foreign Key, UQ = Unique, NN = Not Null

## Schema `better_auth` (4 ตาราง)

### 1. `users` — บัญชีและข้อมูลผู้ใช้

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | TEXT | PK | No | Better Auth user ID |
| `name` | TEXT |  | No | ชื่อ-นามสกุล |
| `email` | TEXT | UQ | No | อีเมลรับการแจ้งเตือน |
| `email_verified` | BOOLEAN |  | No | สถานะยืนยันอีเมล |
| `image` | TEXT |  | Yes | URL รูปผู้ใช้ |
| `username` | TEXT | UQ | No | Username สำหรับเข้าสู่ระบบ |
| `display_username` | TEXT |  | Yes | Username สำหรับแสดงผล |
| `role` | TEXT |  | No | `ผู้ดูแลระบบ` / `เจ้าหน้าที่` / `อาจารย์` / `หน่วยโสต` |
| `banned` | BOOLEAN |  | No | `true` หมายถึงปิดบัญชี |
| `ban_reason` | TEXT |  | Yes | เหตุผลปิดบัญชี |
| `ban_expires` | TIMESTAMPTZ |  | Yes | วันหมดอายุการปิดบัญชี; null = ไม่หมดอายุ |
| `created_by` | TEXT |  | Yes | User ID ของผู้ดูแลที่สร้างบัญชี |
| `must_change_password` | BOOLEAN |  | No | บังคับเปลี่ยนรหัสผ่านชั่วคราว |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไขล่าสุด |

### 2. `sessions` — Session การเข้าสู่ระบบ

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | TEXT | PK | No | Session ID |
| `expires_at` | TIMESTAMPTZ |  | No | วันหมดอายุ |
| `token` | TEXT | UQ | No | Session token |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |
| `ip_address` | TEXT |  | Yes | IP ล่าสุด |
| `user_agent` | TEXT |  | Yes | Browser/User agent |
| `user_id` | TEXT | FK → `users.id` | No | เจ้าของ session; cascade delete |
| `impersonated_by` | TEXT |  | Yes | Better Auth Admin plugin field |

### 3. `accounts` — Credential/OAuth account ของ Better Auth

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | TEXT | PK | No | Account ID |
| `issuer` | TEXT | UQ (ร่วมกับ `account_id`) | No | ขอบเขตตัวตนของ Better Auth; Username/Password ใช้ `local:credential` |
| `account_id` | TEXT |  | No | Provider account ID |
| `provider_id` | TEXT |  | No | `credential` สำหรับ Username/Password |
| `user_id` | TEXT | FK → `users.id` | No | เจ้าของ account; cascade delete |
| `access_token` | TEXT |  | Yes | Provider access token ถ้ามี |
| `refresh_token` | TEXT |  | Yes | Provider refresh token ถ้ามี |
| `id_token` | TEXT |  | Yes | Provider ID token ถ้ามี |
| `access_token_expires_at` | TIMESTAMPTZ |  | Yes | อายุ access token |
| `refresh_token_expires_at` | TIMESTAMPTZ |  | Yes | อายุ refresh token |
| `scope` | TEXT |  | Yes | Provider scope |
| `password` | TEXT |  | Yes | Password hash ของ Better Auth; ไม่ใช่ plain text |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

### 4. `verifications` — Token ยืนยันและรีเซ็ตรหัสผ่าน

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | TEXT | PK | No | Verification ID |
| `identifier` | TEXT |  | No | ตัวระบุของ token |
| `value` | TEXT |  | No | ค่า token |
| `expires_at` | TIMESTAMPTZ |  | No | วันหมดอายุ |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

## Schema `app` (12 ตาราง)

### 5. `exam_rounds` — รอบสอบ

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสรอบสอบ |
| `name` | TEXT | UQ* | No | ชื่อรอบแบบไม่ hard-code |
| `academic_year` | TEXT | UQ* | No | ปีการศึกษา |
| `semester` | TEXT | UQ* | No | ภาคการศึกษา |
| `submission_starts_on` | DATE |  | Yes | วันเปิดรับต้นฉบับ |
| `submission_ends_on` | DATE |  | Yes | วันปิดรับต้นฉบับ |
| `is_active` | BOOLEAN |  | No | เปิด/ปิดรอบสอบ |
| `created_by` | TEXT | FK → `users.id` | No | เจ้าหน้าที่ผู้สร้าง |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

UQ* = unique ร่วม `(name, academic_year, semester)`

### 6. `subjects` — รายวิชาในรอบสอบ

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสรายวิชาในรอบ |
| `round_id` | UUID | FK → `exam_rounds.id` | No | รอบสอบ |
| `course_code` | TEXT | UQ* | No | รหัสวิชา |
| `course_name` | TEXT |  | No | ชื่อวิชา |
| `group_no` | TEXT | UQ* | No | กลุ่มเรียน |
| `instructor_id` | TEXT | FK → `users.id` | No | อาจารย์ผู้รับผิดชอบ |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

UQ* = unique ร่วม `(round_id, course_code, group_no)`

### 7. `rooms` — ข้อมูลห้องจริง

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสห้อง |
| `code` | TEXT | UQ | No | รหัสห้อง |
| `name` | TEXT |  | No | ชื่อห้อง |
| `building` | TEXT |  | Yes | อาคาร |
| `capacity` | INTEGER | CHECK | No | ความจุ ≥ 0 |
| `is_active` | BOOLEAN |  | No | สถานะใช้งาน |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

### 8. `exam_rooms` — ตารางกลางรายวิชา–ห้องสอบ

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสตารางสอบต่อห้อง |
| `subject_id` | UUID | FK → `subjects.id` | No | รายวิชา |
| `room_id` | UUID | FK → `rooms.id` | No | ห้องสอบ |
| `exam_date` | DATE | UQ* | No | วันที่สอบ |
| `starts_at` | TIME | UQ* | No | เวลาเริ่ม |
| `ends_at` | TIME | CHECK | No | เวลาสิ้นสุดต้องหลังเวลาเริ่ม |
| `student_count` | INTEGER | CHECK | Yes | ข้อมูลเดิมเท่านั้น ไม่ใช้เป็นจำนวนข้อสอบในคำขอใหม่ |
| `note` | TEXT |  | Yes | หมายเหตุ |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

UQ* = unique ร่วม `(subject_id, room_id, exam_date, starts_at)` ตารางนี้ทำให้ 1 ห้องมีหลายวิชาและ 1 วิชามีหลายห้อง

### 9. `exam_requests` — แบบฟอร์มส่งข้อสอบ

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสคำขอ |
| `request_no` | TEXT | UQ | No | เลขอ้างอิงที่อ่านได้ |
| `subject_id` | UUID | FK → `subjects.id` | No | รายวิชา |
| `instructor_id` | TEXT | FK → `users.id` | No | อาจารย์ผู้ส่ง |
| `page_count` | INTEGER | CHECK | No | จำนวนหน้า > 0 |
| `original_copy_count` | INTEGER | CHECK | No | ค่าเดิม 1 เพื่อ compatibility ไม่กำหนดให้ส่งกระดาษอีกต่อไป |
| `print_detail` | TEXT |  | Yes | รายละเอียดข้อความจากระบบเดิม |
| `submission_form` | JSONB |  | Yes | แบบฟอร์มออนไลน์ตรวจด้วย submissionFormSchema; NULL คือไม่ระบุในระบบเดิม |
| `status` | `request_status` |  | No | สถานะตาม workflow |
| `reject_reason` | TEXT |  | Yes | เหตุผลส่งกลับแก้ไข |
| `submitted_at` | TIMESTAMPTZ |  | Yes | เวลาส่งตรวจล่าสุด |
| `locked_at` | TIMESTAMPTZ |  | Yes | เวลาที่เข้าสถานะตัดข้อสอบ |
| `cancelled_at` | TIMESTAMPTZ |  | Yes | Soft Delete timestamp |
| `cancelled_by` | TEXT | FK → `users.id` | Yes | ผู้ยกเลิก |
| `cancellation_reason` | TEXT |  | Yes | เหตุผลยกเลิก |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

### 10. `request_rooms` — Snapshot คำขอแยกห้อง

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัส snapshot |
| `request_id` | UUID | FK → `exam_requests.id` | No | คำขอ |
| `exam_room_id` | UUID | FK → `exam_rooms.id` | No | ตารางสอบต้นทาง |
| `room_code` | TEXT |  | No | Snapshot รหัสห้อง |
| `room_name` | TEXT |  | No | Snapshot ชื่อห้อง |
| `building` | TEXT |  | Yes | Snapshot อาคาร |
| `exam_date` | DATE |  | No | Snapshot วันที่สอบ |
| `starts_at` | TIME |  | No | Snapshot เวลาเริ่ม |
| `ends_at` | TIME |  | No | Snapshot เวลาสิ้นสุด |
| `student_count` | INTEGER | CHECK | No | ยอดอาจารย์ขอ/ผู้สอบ 1 ชุดต่อคน; ร่างอนุญาต 0 แต่ส่งต้อง > 0 และไม่เกินความจุ |
| `base_copy_count` | INTEGER | CHECK | No | ยอดหลักหน่วยโสต ≥ 0; ยืนยันแผนต้อง > 0 เริ่มจากยอดอาจารย์ ปรับต้องมีเหตุผล |
| `reserve_count` | INTEGER | CHECK | No | สำรอง; ค่าเริ่มต้น 1 |
| `print_count` | INTEGER | CHECK | No | ต้องเท่ากับ base_copy_count + reserve_count |
| `sender_name` | TEXT |  | No | Snapshot ชื่อผู้ส่ง |
| `note` | TEXT |  | Yes | หมายเหตุบนใบปะหน้า |
| `qr_token` | UUID | UQ | No | Legacy เท่านั้น ไม่สร้าง QR/เปิดหน้าสแกนในรุ่นปัจจุบัน |
| `created_at` | TIMESTAMPTZ |  | No | วันที่ snapshot |

Unique ร่วม `(request_id, exam_room_id)`

### 11. `exam_files` — Metadata ไฟล์ข้อสอบใน MinIO

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสไฟล์ |
| `request_id` | UUID | FK → `exam_requests.id` | No | คำขอ |
| `uploaded_by` | TEXT | FK → `users.id` | No | ผู้อัปโหลด |
| `kind` | `exam_file_kind` | UQ* | No | `ต้นฉบับ` / `พร้อมพิมพ์` |
| `original_file_name` | TEXT |  | No | ชื่อเดิมเพื่อแสดงผลเท่านั้น |
| `storage_key` | TEXT | UQ | No | Random object key ใน private MinIO bucket |
| `content_type` | TEXT |  | No | ต้องเป็น `application/pdf` |
| `size_bytes` | INTEGER | CHECK | No | 1–104,857,600 bytes |
| `sha256` | TEXT |  | No | SHA-256 hex |
| `version` | INTEGER | UQ* | No | เวอร์ชัน > 0 |
| `uploaded_at` | TIMESTAMPTZ |  | No | วันที่อัปโหลด |

UQ* = unique ร่วม `(request_id, kind, version)`

### 12. `cover_sheets` — ไฟล์ใบปะหน้าแยกห้อง

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสใบปะหน้า |
| `request_room_id` | UUID | FK → `request_rooms.id` | No | ห้องของคำขอ |
| `storage_key` | TEXT | UQ | No | Object key แยกจากไฟล์ข้อสอบ |
| `sha256` | TEXT |  | No | SHA-256 ของ PDF |
| `version` | INTEGER | UQ* | No | เวอร์ชัน |
| `print_revision` | INTEGER |  | Yes | รุ่นแผนพิมพ์ที่สร้าง PDF; NULL สำหรับประวัติเดิม |
| `generated_by` | TEXT | FK → `users.id` | No | หน่วยโสตผู้สร้าง |
| `generated_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |

UQ* = unique ร่วม `(request_room_id, version)`

### 13. `print_jobs` — งานพิมพ์

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสงานพิมพ์ |
| `request_id` | UUID | FK → `exam_requests.id` | No | คำขอ |
| `selected_exam_file_id` | UUID | FK → `exam_files.id` | Yes | ไฟล์ที่เลือกสำหรับงานนี้ ต้องอยู่ในคำขอเดียวกัน; NULL ของงานเก่าไม่เดาย้อนหลัง |
| `revision` | INTEGER |  | No | รุ่นแผน เริ่ม 1 เพิ่มเมื่อไฟล์/จำนวนเปลี่ยน |
| `confirmed_at` | TIMESTAMPTZ |  | Yes | เวลาหน่วยโสตยืนยันไฟล์และจำนวน; NULL ต้องยืนยันก่อนเริ่ม |
| `operator_id` | TEXT | FK → `users.id` | No | หน่วยโสตผู้พิมพ์ |
| `status` | `print_status` |  | No | รอพิมพ์/กำลังพิมพ์/พิมพ์เสร็จแล้ว |
| `total_copies` | INTEGER | CHECK | No | ผลรวมจำนวนพิมพ์ทุกห้อง |
| `started_at` | TIMESTAMPTZ |  | Yes | เวลาเริ่ม |
| `completed_at` | TIMESTAMPTZ |  | Yes | เวลาเสร็จ |
| `note` | TEXT |  | Yes | หมายเหตุ |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |
| `updated_at` | TIMESTAMPTZ |  | No | วันที่แก้ไข |

### 14. `notifications` — คิวและผลการส่งอีเมล

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสแจ้งเตือน |
| `user_id` | TEXT | FK → `users.id` | Yes | ผู้รับในระบบ |
| `request_id` | UUID | FK → `exam_requests.id` | Yes | คำขอที่เกี่ยวข้อง |
| `type` | `notification_type` |  | No | ประเภทเหตุการณ์ |
| `subject` | TEXT |  | No | Subject อีเมล |
| `message` | TEXT |  | No | เนื้อหาอีเมล |
| `email_to` | TEXT |  | No | อีเมลผู้รับ snapshot |
| `delivery_status` | `mail_status` |  | No | `Pending` / `Sent` / `Failed` |
| `attempts` | INTEGER | CHECK | No | จำนวนครั้งที่ลองส่ง |
| `last_error` | TEXT |  | Yes | ข้อผิดพลาดล่าสุด |
| `sent_at` | TIMESTAMPTZ |  | Yes | เวลาส่งสำเร็จ |
| `created_at` | TIMESTAMPTZ |  | No | วันที่สร้าง |

ไม่มี `read_at` หรือสถานะอ่านแล้ว เพราะระบบยืนยันได้เฉพาะผลการส่ง ไม่ใช่การเปิดอีเมล

### 15. `request_status_history` — ประวัติสถานะคำขอ

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | UUID | PK | No | รหัสประวัติ |
| `request_id` | UUID | FK → `exam_requests.id` | No | คำขอ |
| `from_status` | `request_status` |  | Yes | สถานะต้นทาง; null ตอนสร้าง |
| `to_status` | `request_status` |  | No | สถานะปลายทาง |
| `actor_id` | TEXT | FK → `users.id` | Yes | ผู้ดำเนินการ; set null เมื่อลบผู้ใช้ |
| `actor_username_snapshot` | TEXT |  | No | Username snapshot |
| `actor_role_snapshot` | TEXT |  | No | บทบาท snapshot |
| `reason` | TEXT |  | Yes | เหตุผล/หมายเหตุ |
| `created_at` | TIMESTAMPTZ |  | No | เวลาเปลี่ยนสถานะ |

### 16. `audit_logs` — บันทึกตรวจสอบย้อนหลัง

| Column | Type | Key | Null | Description |
|---|---|---|:---:|---|
| `id` | BIGSERIAL | PK | No | ลำดับบันทึก |
| `actor_id` | TEXT | FK → `users.id` | Yes | ผู้ดำเนินการ; set null เมื่อลบผู้ใช้ |
| `actor_username_snapshot` | TEXT |  | No | Username snapshot |
| `actor_role_snapshot` | TEXT |  | No | บทบาท snapshot |
| `action` | TEXT |  | No | รหัสเหตุการณ์ เช่น `EXAM_FILE_UPLOADED` |
| `target_type` | TEXT |  | No | ชนิดข้อมูลเป้าหมาย |
| `target_id` | TEXT |  | Yes | ID เป้าหมายแบบ polymorphic |
| `metadata` | JSONB |  | No | รายละเอียดที่ไม่เก็บ secret/ไฟล์ |
| `ip_address` | TEXT |  | Yes | IP ผู้เรียก |
| `user_agent` | TEXT |  | Yes | Browser/User agent |
| `created_at` | TIMESTAMPTZ |  | No | เวลาเกิดเหตุการณ์ |

Factory Reset ไม่ลบตารางนี้ และ snapshot ทำให้ประวัติยังอ่านได้หลังบัญชีต้นทางถูกลบ

Migration `0005_retire_delivery_distribution` ย้ายประวัติจาก `deliveries` และ `distributions` (ถ้ามี) เข้า `audit_logs` ก่อนลบสองตาราง โดยใช้ action `LEGACY_DELIVERY_ARCHIVED` / `LEGACY_DISTRIBUTION_ARCHIVED` และ target เป็นคำขอ เก็บแถวเดิมทั้งหมดใน `metadata.legacy_record` พร้อมชื่อบัญชี/บทบาทของผู้เกี่ยวข้อง ตารางต้นทาง รุ่น migration และเวลา archive ส่วน `created_at` คงเวลาของเหตุการณ์เดิม ไม่ลบไฟล์ลายเซ็นใน storage

## Enum และสถานะบังคับ

- `request_status`: ฉบับร่าง, รอตรวจสอบ, ปฏิเสธ/ส่งกลับแก้ไข, ตัดข้อสอบ, กำลังพิมพ์, พิมพ์เสร็จแล้ว (จบงาน); ส่งมอบแล้ว คงใน PostgreSQL enum เพื่ออ่านประวัติเดิม แต่ไม่ใช่สถานะที่เปลี่ยนไปได้ในระบบปัจจุบัน
- `print_status`: `รอพิมพ์`, `กำลังพิมพ์`, `พิมพ์เสร็จแล้ว`
- `exam_file_kind`: `ต้นฉบับ`, `พร้อมพิมพ์`
- `notification_type`: `สร้างบัญชี`, `คำขอใหม่`, `ยกเลิกคำขอ`, `รับคำขอ`, `ส่งกลับแก้ไข`, `เริ่มพิมพ์`, `พิมพ์เสร็จ`, `พร้อมส่งมอบ`, `ส่งมอบ`, `รีเซ็ตรหัสผ่าน`
- `mail_status`: `Pending`, `Sent`, `Failed`

## โครงสร้าง submission_form (migration 0004)

| Field | Type | เงื่อนไขก่อนส่งคำขอ |
|---|---|---|
| department | string | สาขาวิชา 1–120 ตัวอักษร |
| language | string | ไทย / อังกฤษ / ไทยและอังกฤษ |
| printLayout | string | หน้าเดียว / สองหน้า / Booklet / อื่น ๆ |
| otherPrintLayout | string | ≤ 200; จำเป็นเมื่อเลือกรูปแบบอื่น ๆ |
| materials | string[] | อย่างน้อยหนึ่งข้อ; ไม่มี ห้ามเลือกคู่ข้ออื่น |
| otherMaterials | string | ≤ 300; จำเป็นเมื่อเลือกอุปกรณ์อื่น ๆ |
| computerAnswerSheet | string | ต้องการ / ไม่ต้องการ |
| instructions | string | คำอธิบาย ≤ 600 |
| scheduleType | string | ในตาราง / นอกตาราง |
| coordinatorPhone | string | เบอร์ติดต่อ 3–60 |

ร่างเก็บข้อมูลไม่ครบได้ แต่ส่งต้องผ่าน schema เดียวกับ UI ใน src/lib/submission-form.ts จำนวนพิมพ์รวมงาน = ผลรวม request_rooms.print_count ใบปะหน้าใช้รุ่นตรงกับ print_jobs.revision ไม่มีจำนวนที่กรอกแยก Migration 0004 เติม base_copy_count จาก student_count เดิม ไม่คำนวณยอดรวม/สถานะเก่าใหม่ และไม่เดาว่างานเก่าเคยพิมพ์ไฟล์ใด หลัง migration 0005 เหลือ 16 ตารางของระบบ
