# ผลทดสอบ Docker Compose — 4 ตุลาคม 2569

## แก้ด่วนล่าสุด 5 ตุลาคม 2569 — ไม่รีเซ็ตรหัสเมื่อเปิด Docker

ผู้ใช้ยกเลิกการ sync อัตโนมัติแล้ว Local startup กลับมาใช้ `db:seed-admin -- --if-empty` ส่วน `--sync-existing` ใช้เฉพาะกู้บัญชีด้วยคำสั่ง manual ใน README ผลด้านล่างที่กล่าวถึงการเขียนทับรหัสเป็นประวัติของรุ่นก่อนการแก้นี้ ไม่ใช่พฤติกรรมปัจจุบัน

- ทดสอบ recreate/start container setup กับฐานข้อมูลเดิม: log แสดง `An administrator already exists; bootstrap skipped.` และจบด้วย exit code 0
- เปรียบเทียบ checksum ของ users, accounts และ sessions ก่อน/หลัง: เหมือนเดิมทั้งหมด จึงไม่เปลี่ยน hash รหัสผ่าน ข้อมูลบัญชี session หรือ must_change_password
- เว็บเดิมตอบ `/api/health` HTTP 200 ไม่ล้าง PostgreSQL หรือ MinIO
- Unit tests ผ่าน 55 รายการ (integration tests ที่ต้องเตรียมฐานข้อมูลเฉพาะข้าม 3 รายการ) และเพิ่ม regression test ห้าม startup เปิด `--sync-existing`
- ESLint และ Next.js production build ผ่าน

## อัปเดต 5 ตุลาคม 2569 — ผู้ดูแลตาม env

คำสั่งผู้ใช้ล่าสุดให้ local Docker อัปเดตบัญชีผู้ดูแลตาม env แม้มีบัญชีอยู่แล้ว ผลทดสอบใหม่นี้แทนพฤติกรรม bootstrap แบบข้ามบัญชีเดิมในผลวันที่ 4 ตุลาคมด้านล่าง:

| รายการตรวจ | ผล |
|---|---|
| Clone จาก GitHub + env template + volumes ว่าง | สร้างบัญชี `systemadmin` และล็อกอินด้วยรหัสเริ่มต้นใน template ได้จริง |
| เปลี่ยนรหัสผ่านผ่านหน้าเว็บ | เข้าถึง dashboard ได้หลังตั้งรหัสส่วนตัว |
| เปิด Compose ซ้ำหลังเปลี่ยนรหัสผ่าน | `setup` sync บัญชีเดิมจาก env, hash รหัสใหม่ ยกเลิก session เดิม บังคับเปลี่ยนรหัสครั้งแรก และบันทึก `USER_PASSWORD_RESET` |
| Login หลัง sync ผ่านเบราว์เซอร์ | รหัสใน env ใช้ได้ และ session เดิมถูกส่งกลับหน้า login |
| Sync ซ้ำเมื่อรหัสตรงแล้ว | ไม่สร้างบัญชีหรือ reset password ซ้ำ ไม่ยกเลิก session และไม่แก้สถานะเปลี่ยนรหัสครั้งแรก |
| ข้อมูลเดิม | บัญชีเดิมและห้องสอบทดสอบยังอยู่ ไม่ล้าง PostgreSQL หรือ MinIO |
| Unit tests | ผ่าน 54 รายการ; integration tests ที่ต้องเตรียมฐานข้อมูลเฉพาะแยกข้าม 3 รายการ |
| Lint / Build | ผ่านทั้ง ESLint และ Next.js production build; ไม่นำสคริปต์ชั่วคราวใน tmp/output มาตรวจชนิดของแอป |

ทดสอบบน Compose project แยก `exam-bootstrap-check20261005` โดยไม่ใช้ volumes ของเว็บจริง การอัปเดตนี้เปลี่ยนเฉพาะ local `compose.app.yaml`; production profile ยังใช้คำสั่ง bootstrap แบบ manual เดิม

## ผลเดิมวันที่ 4 ตุลาคม

ทดสอบคำสั่งเปิดระบบตาม README จริงบน Docker Desktop โดยไม่รีเซ็ตข้อมูลเดิม:

```bash
docker compose -f compose.yaml -f compose.app.yaml up -d --build
```

ทดสอบเพิ่มเติมด้วย Compose project แยกและ volumes ว่าง เพื่อจำลองผู้ที่ clone ใหม่ ใช้ image เดียวกับเว็บจริง แต่แยกพอร์ต ฐานข้อมูล บัญชี และไฟล์ทดสอบทั้งหมด

| รายการตรวจ | ผล |
|---|---|
| Build image และเปิดเว็บ | ผ่าน; เว็บจริงเปิดที่ `http://localhost:3000` และสถานะ healthy |
| เชื่อม PostgreSQL | `/api/health` ตอบ HTTP 200 พร้อม `status: ok` |
| เริ่มจากฐานข้อมูลว่าง | รัน migration ครบ 6 รายการ สร้าง `better_auth` 4 ตาราง และ `app` 12 ตาราง |
| สร้างผู้ดูแลเริ่มต้น | สร้าง 1 บัญชีพร้อม credential แบบ hash และบังคับเปลี่ยนรหัสผ่านครั้งแรก |
| ใช้งานผ่านเบราว์เซอร์ | เข้าสู่ระบบ เปลี่ยนรหัสผ่าน และเปิด dashboard ได้ ไม่มี console error |
| หยุดและเปิด Compose ซ้ำ | เก็บบัญชี รหัสผ่านใหม่ และ session เดิม; migration ทำซ้ำได้โดยไม่สร้างตารางหรือบัญชีซ้ำ |
| เปลี่ยนค่า bootstrap หลังมีผู้ดูแล | ข้ามการสร้างบัญชี แม้ส่ง Username/Password เริ่มต้นชุดใหม่เข้า setup |
| MinIO private | การดูรายการไฟล์และดาวน์โหลดไฟล์โดยไม่มีสิทธิ์ตอบ HTTP 403 |
| Presigned URL | อัปโหลด PDF ทดสอบ ดาวน์โหลดกลับ และเปรียบเทียบ bytes ตรงกัน |
| CORS | อนุญาต localhost/127.0.0.1 ของเว็บ; origin นอก allowlist ไม่ได้รับ CORS header |
| ข้อมูลเดิม | ยังคงผู้ใช้ 4 บัญชี คำขอ 2 รายการ ไฟล์ 2 รายการ และ credential เดิมไม่เปลี่ยน |
| ตรวจโค้ด | Lint ผ่าน; unit tests ผ่าน 49 รายการ โดย integration tests ที่ไม่ได้เปิดในคำสั่งนี้ข้าม 3 รายการ |

## ปัญหาที่พบและแก้ระหว่างทดสอบ

`minio/mc` image ที่ใช้ไม่มีคำสั่ง `sed` ทำให้ขั้นตั้งค่า CORS เดิมล้มเหลว แต่ `exit 0` กลบข้อผิดพลาดไว้ ปรับ local Compose ให้ตั้ง CORS ผ่าน `MINIO_API_CORS_ALLOW_ORIGIN` ใน MinIO และใช้ shell `-ec` สำหรับสร้าง private bucket เพื่อไม่รายงานความสำเร็จหากขั้นตั้งค่าล้มเหลว

ขอบเขตครั้งนี้คือการเริ่ม Docker, migration/bootstrap, การเข้าสู่ระบบ และ storage smoke test ไม่ใช่การทดสอบ workflow พิมพ์ข้อสอบครบทั้ง 4 บทบาท การโหลดพร้อมกัน หรืออัปโหลดเต็มขนาด 100 MB

หลังทดสอบลบเฉพาะ project และ volumes ชุดทดสอบที่สร้างใหม่ เก็บเว็บและ volumes เดิมไว้ใช้งานต่อ
