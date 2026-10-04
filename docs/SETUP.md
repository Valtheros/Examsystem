# การตั้งค่าและติดตั้งระบบ

## เครื่องพัฒนาปัจจุบัน — ใช้ข้อมูล Docker เดิม

เว็บล่าสุดเปิดที่ `http://localhost:3000` ใช้ `compose.yaml` ร่วมกับ `compose.app.yaml` ไม่ใช่ production Compose ซึ่งใช้ชื่อ volume ต่างกัน

เปิดผ่าน `http://127.0.0.1:3000` ได้เช่นกัน เมื่อ `BETTER_AUTH_URL` เป็น loopback ระบบอนุญาต localhost และ 127.0.0.1 เฉพาะ protocol/port เดียวกัน ส่วน Auth client ใช้ origin ของหน้าที่เปิดเพื่อให้ session cookie อยู่บน hostname นั้น หากใช้โดเมน production จะอนุญาตเฉพาะ origin ที่ตั้งไว้

```powershell
# ตั้ง DATABASE_URL และ DIRECT_DATABASE_URL ให้ชี้ PostgreSQL เดิมก่อน migrate
npm run db:migrate
docker compose -f compose.yaml -f compose.app.yaml up -d --build web
```

ไม่ใช้ `down -v` และไม่ seed/reset ฐานข้อมูลเดิม การตั้งค่านี้ใช้บัญชี Docker local เดิม, Mailpit สำหรับอีเมล และ bind เว็บเฉพาะ 127.0.0.1 ยังไม่ใช่การเปิดให้ใช้งานจากอินเทอร์เน็ต ตัวเลือก `.env.app.local` ใช้ตั้ง BETTER_AUTH_SECRET เฉพาะเครื่องได้ (ห้าม commit; เปลี่ยน secret ทำให้ต้อง login ใหม่) ไม่โหลด `.env.local` ของเครื่องเข้า container เพราะอาจมี token ของบริการอื่นที่ไม่เกี่ยวข้อง

ก่อนย้ายไปเครื่องเซิร์ฟเวอร์ ให้กำหนดโดเมน TLS, secret จริง, บัญชี MinIO จำกัดสิทธิ์ และย้ายข้อมูล/ไฟล์จาก volumes เดิมอย่างชัดเจนตามขั้นตอนด้านล่าง ห้ามเปิด production Compose ใหม่แล้วเข้าใจว่าใช้ข้อมูลชุดเดิมโดยอัตโนมัติ

Production รันด้วย Docker Compose ทั้งระบบ: Next.js, PostgreSQL, MinIO และ Caddy อยู่บนเครื่องเซิร์ฟเวอร์เดียวกัน ระบบไม่ใช้ Supabase, Cloudflare R2 หรือ Vercel

## หน้าเว็บดูฐานข้อมูลในเครื่อง (Drizzle Studio)

PostgreSQL ที่พอร์ต 5432 เป็น database protocol ไม่ใช่ HTTP จึงเปิด `http://localhost:5432` ในเบราว์เซอร์ไม่ได้ ใช้ Drizzle Studio ที่มีอยู่แล้วในโปรเจกต์ ไม่ต้องย้าย ORM ไป Prisma หรือสร้างหน้า database ใน Next.js

```powershell
cd D:\codex\se\Examsystem
npm run db:studio
```

เปิด `https://local.drizzle.studio` โดยต้องเปิด Terminal ที่รันคำสั่งค้างไว้ ตัวเชื่อมต่อทำงานเฉพาะ localhost:4983 ไม่ใช่พอร์ตของเว็บข้อสอบ ไม่ต้องเข้าสู่ระบบด้วย systemadmin

หากค้างที่ Connecting ใน Chrome/Edge ให้เปิด Site information ข้าง URL แล้วอนุญาต **Apps on device / Local network access** สำหรับ `local.drizzle.studio` จากนั้น reload หน้านั้น ไม่ต้องปิดความปลอดภัยของเบราว์เซอร์ทั้งระบบ

เลือก schema `app` เพื่อดูตารางระบบข้อสอบ หรือ `better_auth` เพื่อดูตารางบัญชี แล้วคลิกตารางทางซ้ายเพื่อดูข้อมูลและโครงสร้าง Studio ใช้สิทธิ์ฐานข้อมูลโดยตรงและแก้ไข/ลบได้ การแก้ใน Studio จะข้าม validation, authorization และ Audit Log ของเว็บ อย่าแก้ password hash/session หรือข้อมูลจริงหากไม่ทราบผลกระทบ

`drizzle.config.ts` ใช้ `DIRECT_DATABASE_URL` ก่อน `DATABASE_URL` หากไม่ได้กำหนดจะใช้ PostgreSQL Docker local เดิม อย่าชี้ URL ไปฐานข้อมูลทดสอบหรือฐานข้อมูลอื่นโดยไม่ตั้งใจ ไม่ใช้ `--host 0.0.0.0` และไม่เปิด Studio ต่ออินเทอร์เน็ต หากเซิร์ฟเวอร์อยู่คนละเครื่องให้ใช้ SSH tunnel [เอกสาร Drizzle Studio](https://orm.drizzle.team/docs/drizzle-kit-studio)

ปิดเฉพาะเครื่องมือด้วย Ctrl+C ใน Terminal โดยไม่กระทบเว็บ ฐานข้อมูล หรือไฟล์เดิม Adminer ไม่ได้ใช้แล้วและถูกนำออกจาก Compose

## 1. สิ่งที่ต้องเตรียมบนเซิร์ฟเวอร์

- Linux server ที่ติดตั้ง Docker Engine และ Docker Compose v2
- จุดเริ่มต้นสำหรับระบบขนาดเล็ก: 2–4 vCPU, RAM 4–8 GB และ SSD ที่เหลืออย่างน้อย 100 GB โดยต้องปรับตามจำนวนผู้ใช้และปริมาณไฟล์จริง
- พอร์ตสาธารณะ 80/TCP, 443/TCP และ 443/UDP
- DNS สองชื่อที่ชี้มายังเซิร์ฟเวอร์ เช่น `exam.example.ac.th` และ `exam-files.example.ac.th`
- พื้นที่ Docker volume ควรอยู่บนดิสก์ที่เข้ารหัสด้วย LUKS/BitLocker หรือเทียบเท่า เพราะ Compose ไม่สามารถบังคับ Encryption at Rest ของดิสก์ให้เองได้

ขนาดเครื่องเป็นเพียงค่าเริ่มต้น รุ่นนี้ยังไม่กำหนดเกณฑ์ concurrent users จนกว่าจะทราบสเปกและเครือข่ายของเครื่องจริง

## 2. PostgreSQL และพื้นที่ข้อมูล

Compose เปิด PostgreSQL 17 ภายในเครือข่าย Docker โดยไม่เปิดพอร์ตฐานข้อมูลต่ออินเทอร์เน็ต Better Auth สร้างตารางใน schema `better_auth` และข้อมูลระบบอยู่ใน schema `app`

- ฐานข้อมูลเก็บใน named volume `postgres_data`
- ไฟล์ข้อสอบเก็บใน named volume `minio_data`
- ห้ามใช้ `docker compose down -v` บนระบบจริง เพราะ `-v` จะลบ volumes และข้อมูล
- ค่ารหัสผ่าน `POSTGRES_PASSWORD` ควรสุ่มด้วย `openssl rand -hex 32` เพื่อให้เป็นอักขระ URL-safe

Docker volume ช่วยให้ข้อมูลอยู่ต่อเมื่อ container ถูกสร้างใหม่ แต่ไม่ใช่ระบบสำรองข้อมูล หากดิสก์เสียข้อมูลยังสูญหายได้

## 3. ตัวแปร Production

คัดลอกไฟล์ตัวอย่างโดยไม่ commit ไฟล์จริง:

```bash
cp .env.docker.example .env.docker
```

แก้ค่าต่อไปนี้ใน `.env.docker`:

- `APP_DOMAIN`, `FILES_DOMAIN`, `APP_ORIGIN`: โดเมนจริงของระบบ
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: ฐานข้อมูลและบัญชีภายใน Docker
- `BETTER_AUTH_SECRET`: สุ่มอย่างน้อย 32 ตัวอักษร
- `BOOTSTRAP_ADMIN_*`: บัญชีผู้ดูแลระบบเริ่มต้นและรหัสผ่านชั่วคราวอย่างน้อย 12 ตัวอักษร
- `MINIO_ROOT_*`: บัญชีดูแล MinIO ใช้เฉพาะตอน initialize
- `MINIO_APP_*`: บัญชีแยกสำหรับตัวแอปและต้องใช้ secret คนละค่ากับ root
- `GMAIL_*`, `MAIL_FROM`: Gmail OAuth2 ของกล่องอีเมลผู้ส่ง

สร้าง secret ได้ด้วย `openssl rand -base64 48` และต้องเก็บ `.env.docker` ไว้เฉพาะบนเซิร์ฟเวอร์

## 4. เปิดระบบครั้งแรก

จาก root ของ repository รัน:

```bash
docker compose --env-file .env.docker -f compose.production.yaml up -d --build
docker compose --env-file .env.docker -f compose.production.yaml --profile tools run --rm seed-admin
docker compose --env-file .env.docker -f compose.production.yaml ps
```

Compose จะทำงานตามลำดับดังนี้:

1. เปิด MinIO และสร้าง private bucket
2. สร้างบัญชี MinIO ของแอปโดยจำกัดสิทธิ์เฉพาะ bucket
3. รอ PostgreSQL พร้อมแล้วรัน Drizzle migration ภายใน Docker
4. เปิด Next.js แล้วตรวจสุขภาพผ่าน `/api/health`
5. เปิด Caddy เพื่อออก TLS certificate และ reverse proxy สองโดเมน

หลัง seed สำเร็จ ให้ลบค่า `BOOTSTRAP_ADMIN_PASSWORD` ออกจาก `.env.docker` หรือเปลี่ยนเป็นค่าที่ไม่ใช้งาน และเข้าสู่ระบบเพื่อเปลี่ยนรหัสผ่านชั่วคราวทันที

## 5. อัปเดตและตรวจ Log

```bash
git pull
docker compose --env-file .env.docker -f compose.production.yaml up -d --build
docker compose --env-file .env.docker -f compose.production.yaml logs -f app caddy minio
```

ข้อมูลฐานข้อมูลอยู่ใน `postgres_data` และไฟล์อยู่ใน `minio_data` การลบ volume หรือดิสก์เสียทำให้ข้อมูลสูญหาย ระบบรุ่นนี้ยังไม่มี automatic backup

สำรองฐานข้อมูลด้วยคำสั่งต่อไปนี้ ไฟล์จะอยู่ในโฟลเดอร์ `backups/` บนเซิร์ฟเวอร์:

```bash
docker compose --env-file .env.docker -f compose.production.yaml --profile tools run --rm backup-db
```

ควรคัดลอกทั้ง database dump และข้อมูล MinIO ไปยังดิสก์หรือเครื่องอื่นเป็นระยะ โดยเฉพาะก่อนอัปเดตระบบหรือ Factory Reset

## 6. Local development

`compose.yaml` มี PostgreSQL, MinIO และ Mailpit สำหรับพัฒนาแยกจากข้อมูล production ส่วน `.env.example` แสดงค่าที่ใช้กับ local services

```bash
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

บริการ local: PostgreSQL `5432`, MinIO API `9000`, MinIO Console `9001`, Mailpit SMTP `1025`, Mailpit UI `8025`

## 7. Migration ลดตารางที่เลิกใช้

Migration `0005_retire_delivery_distribution` ทำให้เหลือ 16 ตารางของระบบ (บัญชี 4 / ธุรกิจ 12) โดยย้ายประวัติรับมอบ/แจกจ่ายเข้า Audit Log ก่อนลบ `deliveries` และ `distributions` ทำใน transaction เดียว ไม่ใช้ `CASCADE` หากมี dependency ที่ไม่คาดไว้ migration จะล้มเหลวและย้อนกลับทั้งชุด ไม่ต้อง reset หรือ seed ข้อมูลเดิม

ก่อนอัปเดตควรสำรองข้อมูลและหยุดเฉพาะเว็บชั่วคราว รัน migration ด้วยบัญชีฐานข้อมูลของระบบ แล้วเปิดเว็บรุ่นใหม่โดยใช้ volumes เดิม ห้ามใช้ `docker compose down -v` หรือ `db:push` แทน migration

สำหรับ local ที่ใช้ `compose.yaml` และ `compose.app.yaml`:

```bash
docker compose -f compose.yaml -f compose.app.yaml build web
docker compose -f compose.yaml -f compose.app.yaml stop web
npm run db:migrate
docker compose -f compose.yaml -f compose.app.yaml up -d --no-deps web
```

ตรวจว่า `DATABASE_URL` / `DIRECT_DATABASE_URL` ชี้ฐานข้อมูลที่ต้องการก่อนรัน (ค่าเริ่มต้น local ใช้ PostgreSQL Docker บน localhost:5432) ตาราง `drizzle.__drizzle_migrations` เป็น metadata จำเป็นไม่นับรวมใน 16 ตาราง และควรปิด/เปิด `npm run db:studio` ใหม่หลัง schema เปลี่ยน
