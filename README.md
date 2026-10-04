<div align="center">
  <img src="public/psu-logo-transparent.png" alt="ตรามหาวิทยาลัยสงขลานครินทร์" height="100" />
  <h1>Examsystem · ระบบจัดพิมพ์ข้อสอบ</h1>
  <p>Clone → ตั้งผู้ดูแล → เปิด Docker → ใช้งานเว็บ</p>
</div>

## สิ่งที่ต้องมี

ติดตั้ง **Git** และ **Docker Compose v2** หากใช้ Windows ให้เปิด Docker Desktop ก่อน

## 1. Clone โปรเจกต์

```bash
git clone https://github.com/Valtheros/Examsystem.git
cd Examsystem
cp .env.app.example .env.app.local
```

บน PowerShell ใช้ `Copy-Item .env.app.example .env.app.local` เพื่อคัดลอกไฟล์ได้เช่นกัน

## 2. ตั้งบัญชีผู้ดูแล

เปิด `.env.app.local` แล้วแก้ค่าเหล่านี้:

```dotenv
BETTER_AUTH_SECRET=ใส่อักษรสุ่มอย่างน้อย32ตัวอักษร
BOOTSTRAP_ADMIN_USERNAME=systemadmin
BOOTSTRAP_ADMIN_EMAIL=อีเมลของคุณ
BOOTSTRAP_ADMIN_NAME=ชื่อผู้ดูแล
BOOTSTRAP_ADMIN_PASSWORD=รหัสผ่านชั่วคราวของคุณ
```

รหัสผ่านต้องมีอย่างน้อย **12 ตัวอักษร** ใช้ตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข ส่วน `BETTER_AUTH_SECRET` ใช้ค่าสุ่มอย่างน้อย 32 ตัวอักษร เก็บไฟล์นี้ไว้เฉพาะเครื่องของคุณ

## 3. เปิดระบบ

```bash
docker compose -f compose.yaml -f compose.app.yaml up -d --build
```

ครั้งแรกจะใช้เวลาสร้าง image และดาวน์โหลดบริการ Docker จากนั้นระบบจะสร้างตาราง สร้างบัญชีผู้ดูแลที่ตั้งไว้ และเปิดเว็บให้อัตโนมัติ

เปิด **[http://localhost:3000](http://localhost:3000)** แล้วเข้าสู่ระบบด้วย Username และ Password ใน `.env.app.local` ระบบจะให้เปลี่ยนรหัสผ่านชั่วคราวครั้งแรก จากนั้นสร้างบัญชีเจ้าหน้าที่ อาจารย์ และหน่วยโสตได้จากหน้าจัดการผู้ใช้

เมื่อเปิดซ้ำ ระบบจะใช้ข้อมูลเดิมและข้ามการสร้างบัญชีหากมีผู้ดูแลอยู่แล้ว การแก้รหัสผ่านใน `.env.app.local` จะไม่เปลี่ยนรหัสผ่านของบัญชีเดิม

## คำสั่งที่ใช้บ่อย

```bash
# ตรวจสถานะ
docker compose -f compose.yaml -f compose.app.yaml ps

# ดู log ของเว็บและการตั้งค่าเริ่มต้น
docker compose -f compose.yaml -f compose.app.yaml logs -f setup web

# หยุดระบบ โดยเก็บข้อมูลไว้
docker compose -f compose.yaml -f compose.app.yaml down

# อัปเดตโค้ดแล้วเปิดระบบใหม่
git pull --ff-only
docker compose -f compose.yaml -f compose.app.yaml up -d --build
```

**อย่าเติม `-v` ในคำสั่ง `down` เพราะจะลบฐานข้อมูลและไฟล์ข้อสอบ** อีเมลสำหรับทดลองดูได้ที่ [localhost:8025](http://localhost:8025)

คำสั่งข้างต้นใช้เปิดระบบในเครื่อง สำหรับติดตั้งบนเซิร์ฟเวอร์พร้อมโดเมนและ HTTPS ดู [คู่มือติดตั้ง Docker](docs/SETUP.md#1-สิ่งที่ต้องเตรียมบนเซิร์ฟเวอร์)
