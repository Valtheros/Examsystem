# การตั้งค่าและติดตั้งระบบ

Production ใช้สถาปัตยกรรมแบบผสม: Supabase ให้บริการเฉพาะ PostgreSQL ส่วน Next.js, MinIO และ Caddy รันอยู่บนเครื่องเซิร์ฟเวอร์ผ่าน Docker Compose ระบบไม่ใช้ Supabase Auth/Storage, Cloudflare R2 หรือ Vercel

## 1. สิ่งที่ต้องเตรียมบนเซิร์ฟเวอร์

- Linux server ที่ติดตั้ง Docker Engine และ Docker Compose v2
- จุดเริ่มต้นสำหรับระบบขนาดเล็ก: 2–4 vCPU, RAM 4–8 GB และ SSD ที่เหลืออย่างน้อย 100 GB โดยต้องปรับตามจำนวนผู้ใช้และปริมาณไฟล์จริง
- พอร์ตสาธารณะ 80/TCP, 443/TCP และ 443/UDP
- DNS สองชื่อที่ชี้มายังเซิร์ฟเวอร์ เช่น `exam.example.ac.th` และ `exam-files.example.ac.th`
- พื้นที่ Docker volume ควรอยู่บนดิสก์ที่เข้ารหัสด้วย LUKS/BitLocker หรือเทียบเท่า เพราะ Compose ไม่สามารถบังคับ Encryption at Rest ของดิสก์ให้เองได้

ขนาดเครื่องเป็นเพียงค่าเริ่มต้น รุ่นนี้ยังไม่กำหนดเกณฑ์ concurrent users จนกว่าจะทราบสเปกและเครือข่ายของเครื่องจริง

## 2. Supabase PostgreSQL

โปรเจกต์ใช้ Supabase เฉพาะ PostgreSQL โดย Better Auth สร้างตารางใน schema `better_auth` และข้อมูลระบบอยู่ใน schema `app`

จาก Supabase Dashboard เปิดเมนู **Connect** แล้วนำ connection string มาใส่ใน `.env.docker`:

- `DATABASE_URL`: ใช้ **Session pooler** พอร์ต 5432 สำหรับแอป Docker ที่ทำงานแบบ persistent และเซิร์ฟเวอร์ IPv4
- `DIRECT_DATABASE_URL`: ใช้ Direct connection สำหรับ migration เมื่อเซิร์ฟเวอร์รองรับ IPv6; หากรองรับเฉพาะ IPv4 ให้ใช้ Session pooler เช่นกัน

ให้คัดลอก connection string จาก Dashboard โดยตรงและ URL-encode รหัสผ่านหากมีอักขระพิเศษ ห้ามใช้ Supabase URL หรือ publishable key เพราะ runtime นี้ไม่ต้องใช้

Supabase Free อาจพักโปรเจกต์เมื่อไม่มีการใช้งาน และไม่มีไฟล์ backup ให้ดาวน์โหลดจาก Dashboard จึงไม่ถือเป็น SLA production และควรทำ `pg_dump` แยกหากภายหลังต้องการสำรองข้อมูล

## 3. ตัวแปร Production

คัดลอกไฟล์ตัวอย่างโดยไม่ commit ไฟล์จริง:

```bash
cp .env.docker.example .env.docker
```

แก้ค่าต่อไปนี้ใน `.env.docker`:

- `APP_DOMAIN`, `FILES_DOMAIN`, `APP_ORIGIN`: โดเมนจริงของระบบ
- `DATABASE_URL`, `DIRECT_DATABASE_URL`: connection strings จาก Supabase
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
3. รัน Drizzle migration บน Supabase
4. เปิด Next.js แล้วตรวจสุขภาพผ่าน `/api/health`
5. เปิด Caddy เพื่อออก TLS certificate และ reverse proxy สองโดเมน

หลัง seed สำเร็จ ให้ลบค่า `BOOTSTRAP_ADMIN_PASSWORD` ออกจาก `.env.docker` หรือเปลี่ยนเป็นค่าที่ไม่ใช้งาน และเข้าสู่ระบบเพื่อเปลี่ยนรหัสผ่านชั่วคราวทันที

## 5. อัปเดตและตรวจ Log

```bash
git pull
docker compose --env-file .env.docker -f compose.production.yaml up -d --build
docker compose --env-file .env.docker -f compose.production.yaml logs -f app caddy minio
```

ข้อมูลไฟล์อยู่ใน Docker volume `minio_data` การลบ volume หรือดิสก์เสียทำให้ไฟล์สูญหาย ระบบรุ่นนี้ยังไม่มี automatic backup

## 6. Local development

`compose.yaml` มี PostgreSQL, MinIO และ Mailpit สำหรับพัฒนาโดยไม่แตะ Supabase production ส่วน `.env.example` แสดงค่าที่ใช้กับ local services

```bash
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

บริการ local: PostgreSQL `5432`, MinIO API `9000`, MinIO Console `9001`, Mailpit SMTP `1025`, Mailpit UI `8025`
