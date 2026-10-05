<div align="center">
  <img src="public/psu-logo-transparent.png" alt="ตรามหาวิทยาลัยสงขลานครินทร์" height="100" />
  <h1>Examsystem · ระบบจัดพิมพ์ข้อสอบ</h1>
  <p>Clone → คัดลอก env → เปิด Docker → ใช้งานเว็บ</p>
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

## 2. ค่าเริ่มต้นใน env (แก้ไขได้)

ไฟล์ `.env.app.example` เตรียมค่าที่ต้องใช้ไว้แล้ว เมื่อคัดลอกเป็น `.env.app.local` สามารถเปิด Docker ในขั้นตอนถัดไปได้เลย หรือแก้ค่าเหล่านี้ตามต้องการ:

```dotenv
BETTER_AUTH_SECRET=36fb43649686ac14dfbc1c80308796e439a8518fdf9ae6ce188c2a05cc42e1f9
BOOTSTRAP_ADMIN_USERNAME=systemadmin
BOOTSTRAP_ADMIN_EMAIL=admin@gmail.com
BOOTSTRAP_ADMIN_NAME=Systemadmin
BOOTSTRAP_ADMIN_PASSWORD=Admin123456789
```

บัญชีเริ่มต้นคือ **`systemadmin` / `Admin123456789`** โดยระบบบังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก หากตั้งรหัสผ่านเอง ต้องมีอย่างน้อย **12 ตัวอักษร** ใช้ตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข

`BETTER_AUTH_SECRET` ด้านบนสุ่มไว้ให้เป็นค่าเริ่มต้นสำหรับทดลองในเครื่อง หากติดตั้งบนเซิร์ฟเวอร์ ให้สุ่มค่าใหม่อย่างน้อย 32 ตัวอักษรสำหรับเครื่องนั้น เก็บ `.env.app.local` ไว้เฉพาะเครื่อง ไม่ commit เข้า Git

ฐานข้อมูล PostgreSQL ที่เก็บไฟล์ MinIO และกล่องเมลทดสอบ Mailpit ตั้งค่าไว้ใน Docker Compose แล้ว ไม่ต้องกรอกค่าเพิ่มสำหรับการเปิดระบบในเครื่อง อีเมล `admin@gmail.com` เป็นข้อมูลบัญชีผู้ดูแล การส่งอีเมลจริงต้องตั้งค่าบัญชีผู้ส่งเพิ่มเติม

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
