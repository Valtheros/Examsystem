# การตั้งค่าและติดตั้งระบบ

Production รันด้วย Docker Compose ทั้งระบบ: Next.js, PostgreSQL, MinIO และ Caddy อยู่บนเครื่องเซิร์ฟเวอร์เดียวกัน ระบบไม่ใช้ Supabase, Cloudflare R2 หรือ Vercel

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
