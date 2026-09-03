# ระบบจัดพิมพ์ข้อสอบ คณะวิทยาศาสตร์

เว็บแอปสำหรับจัดการรอบสอบ แบบฟอร์มส่งต้นฉบับ การตรวจ/ตัดข้อสอบ การพิมพ์ ใบปะหน้า การส่งมอบ และการแจกจ่ายเข้าห้องสอบ

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- PostgreSQL 17 และ Drizzle ORM รันใน Docker
- Better Auth (Username + Admin plugins)
- MinIO private object storage บนเครื่องเซิร์ฟเวอร์
- Nodemailer + Gmail OAuth2
- Docker Compose และ Caddy สำหรับ production

ระบบ production รันด้วย Docker ทั้งหมด ไม่ใช้ Supabase, Cloudflare R2 หรือ Vercel

## Production แบบ Docker

1. อ่าน [การตั้งค่า](docs/SETUP.md)
2. คัดลอก `.env.docker.example` เป็น `.env.docker` แล้วใส่ domain, PostgreSQL password และ secret
3. ชี้ DNS ของโดเมนเว็บและโดเมนไฟล์มายังเซิร์ฟเวอร์
4. เปิดระบบและรัน migration ด้วย Docker Compose
5. สร้างบัญชีผู้ดูแลระบบคนแรกผ่าน service `seed-admin`

```bash
docker compose --env-file .env.docker -f compose.production.yaml up -d --build
docker compose --env-file .env.docker -f compose.production.yaml --profile tools run --rm seed-admin
```

ไฟล์ PDF ถูกอัปโหลดจาก browser ไปยัง MinIO ด้วย Presigned URL โดยตรง ไม่ผ่าน request body ของ Next.js

## ตรวจสอบคุณภาพ

```bash
npm run lint
npm run test
npm run build
```

เมื่อมี test environment พร้อม ใช้ `npm run test:e2e` เพื่อตรวจ workflow ผ่าน browser

## เอกสาร

- [Requirements](docs/REQUIREMENTS.md)
- [Data Dictionary](docs/DATA_DICTIONARY.md)
- [ERD](docs/ERD.md)
- [Environment และ Deployment](docs/SETUP.md)
