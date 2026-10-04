<div align="center">
  <img src="public/psu-logo-transparent.png" alt="ตรามหาวิทยาลัยสงขลานครินทร์" height="110" />
  <h1>Examsystem · ระบบจัดพิมพ์ข้อสอบ</h1>
  <p>จัดตารางสอบ ส่งข้อสอบออนไลน์ และเตรียมงานพิมพ์พร้อมใบปะหน้าซองในระบบเดียว</p>
  <p><strong>Next.js 16 · TypeScript · PostgreSQL 17 · Better Auth · MinIO · Docker</strong></p>
</div>

---

[เริ่มใช้งาน](#เริ่มใช้งานในเครื่อง) · [บทบาทและขั้นตอน](#บทบาทและขั้นตอนการทำงาน) · [Docker](#รันเว็บใน-docker) · [ติดตั้งบนเซิร์ฟเวอร์](#ติดตั้งบนเซิร์ฟเวอร์) · [ดูฐานข้อมูล](#เปิดดูฐานข้อมูล) · [เอกสาร](#เอกสารเพิ่มเติม)

## ระบบนี้ทำอะไรได้บ้าง

- ผู้ดูแลระบบสร้างบัญชี ค้นหาผู้ใช้ จัดการสิทธิ์ และเข้าใช้งานแทนบัญชีอื่นได้
- เจ้าหน้าที่จัดรอบสอบ รายวิชา อาจารย์ ห้อง และวันเวลา พร้อมตรวจเวลาจองห้องทับซ้อน
- อาจารย์ส่งแบบฟอร์ม จำนวนข้อสอบรายห้อง และ PDF สูงสุด 100 MB ผ่านขั้นตอนส่งงาน 3 ขั้น
- หน่วยโสตตรวจข้อสอบ ส่งกลับแก้ไข เลือกไฟล์ เตรียมจำนวนพิมพ์ และสร้างใบปะหน้าซองตามแบบ PSU
- เก็บไฟล์ทุกรุ่น ประวัติสถานะ Audit Log และผลการส่งอีเมล
- รองรับมือถือ โหมดสว่าง/มืด และปิดรับสมัครบัญชีด้วยตนเอง

## เริ่มใช้งานในเครื่อง

ต้องมี **Git**, **Node.js 22.x** พร้อม npm และ **Docker Compose v2** หากใช้ Windows ให้เปิด Docker Desktop ก่อน

### 1. Clone และติดตั้ง dependencies

```bash
git clone https://github.com/Valtheros/Examsystem.git
cd Examsystem
npm ci
```

ใช้ `npm ci` เพื่อติดตั้งเวอร์ชันตาม `package-lock.json` ที่อยู่ใน repository

### 2. ตั้งค่า environment

คัดลอกไฟล์ตัวอย่างเป็น `.env.local`:

```bash
cp .env.example .env.local
```

บน PowerShell ใช้ `Copy-Item .env.example .env.local` ได้เช่นกัน จากนั้นแก้ค่าต่อไปนี้:

| ตัวแปร | ใส่อะไร |
| --- | --- |
| `BETTER_AUTH_SECRET` | ค่าสุ่มอย่างน้อย 32 ตัวอักษร สำหรับ session |
| `BOOTSTRAP_ADMIN_USERNAME` | ชื่อบัญชีผู้ดูแลคนแรก เช่น `systemadmin` |
| `BOOTSTRAP_ADMIN_EMAIL` | อีเมลผู้ดูแล |
| `BOOTSTRAP_ADMIN_NAME` | ชื่อที่แสดงในระบบ |
| `BOOTSTRAP_ADMIN_PASSWORD` | รหัสผ่านชั่วคราวอย่างน้อย 12 ตัวอักษร |

สร้างค่า `BETTER_AUTH_SECRET` ด้วย:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

ค่าเชื่อมต่อ PostgreSQL, MinIO และ Mailpit ใน `.env.example` ตรงกับ Docker local แล้ว สำหรับทดลองในเครื่องยังไม่ต้องตั้ง Gmail OAuth2 อีเมลจะอยู่ใน Mailpit

### 3. เปิดฐานข้อมูลและพื้นที่เก็บไฟล์

```bash
docker compose up -d
docker compose ps
```

รอให้ PostgreSQL แสดงสถานะ `healthy` แล้วสร้างตาราง:

```bash
npm run db:migrate
```

คำสั่งนี้ใช้ connection ที่กำหนดใน environment หรือค่าฐานข้อมูล local ของ `drizzle.config.ts` หากใช้ฐานข้อมูลอื่น ให้อ่าน [วิธีตั้งค่า connection](docs/SETUP.md) ก่อน

### 4. สร้างผู้ดูแลระบบคนแรก

```bash
node --env-file=.env.local --import=tsx scripts/seed-admin.ts
```

คำสั่งนี้โหลดค่าจาก `.env.local` โดยตรง หาก username นี้มีอยู่แล้ว จะไม่เปลี่ยนบัญชีหรือรหัสผ่านเดิม ไม่มีรหัสผ่านกลางที่ใช้ได้กับทุกเครื่อง

### 5. เปิดเว็บ

```bash
npm run dev
```

เปิด **[http://localhost:3000](http://localhost:3000)** แล้วเข้าสู่ระบบด้วยบัญชีที่ตั้งไว้ ระบบจะให้เปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งานครั้งแรก จากนั้นผู้ดูแลสามารถสร้างบัญชีของทั้งสามบทบาทที่เหลือได้จากหน้าจัดการผู้ใช้

| บริการในเครื่อง | URL / พอร์ต | ใช้ทำอะไร |
| --- | --- | --- |
| เว็บข้อสอบ | [localhost:3000](http://localhost:3000) | ใช้งานระบบ |
| Mailpit | [localhost:8025](http://localhost:8025) | ดูอีเมลที่ระบบส่งระหว่างพัฒนา |
| MinIO Console | [localhost:9001](http://localhost:9001) | ดู bucket และไฟล์; บัญชี local ตาม Compose |
| MinIO API | `localhost:9000` | อัปโหลดและดาวน์โหลดไฟล์ผ่าน URL ที่มีอายุจำกัด |
| PostgreSQL | `localhost:5432` | เชื่อมด้วยเครื่องมือฐานข้อมูล; ไม่ใช่หน้าเว็บ |

## บทบาทและขั้นตอนการทำงาน

| บทบาท | หน้าที่ |
| --- | --- |
| ผู้ดูแลระบบ | สร้างบัญชี กำหนดบทบาท เปิด-ปิดบัญชี รีเซ็ตรหัสผ่าน และตรวจ Audit Log |
| เจ้าหน้าที่ | จัดรอบสอบ รายวิชา อาจารย์ ห้อง ความจุ และตารางสอบ |
| อาจารย์ | ส่งข้อสอบเฉพาะวิชาของตน กรอกแบบฟอร์ม จำนวนชุดรายห้อง และแนบ PDF |
| หน่วยโสต | ตรวจข้อสอบ รับงาน กำหนดแผนพิมพ์ สร้างใบปะหน้า และยืนยันพิมพ์เสร็จ |

```text
ฉบับร่าง → รอตรวจสอบ → ตัดข้อสอบ → กำลังพิมพ์ → พิมพ์เสร็จแล้ว
                   ↘ ส่งกลับแก้ไข → ส่งตรวจอีกครั้ง
```

งานในระบบจบเมื่อหน่วยโสตยืนยัน **พิมพ์เสร็จแล้ว** การนำซองไปส่งเจ้าหน้าที่ทำภายนอกระบบ

**จำนวนข้อสอบ:** อาจารย์กำหนดยอดที่ขอแยกต่อห้อง หน่วยโสตใช้ยอดนั้นเป็นค่าพิมพ์หลักเริ่มต้น และเพิ่มสำรองเริ่มต้น 1 ชุด ซึ่งปรับเป็น 0 หรือมากกว่าได้

```text
อาจารย์ขอ 50 ชุด → พิมพ์หลัก 50 + สำรอง 1 = พิมพ์รวม 51 ชุด
```

หากหน่วยโสตเปลี่ยนยอดหลัก ต้องระบุเหตุผล ระบบเก็บยอดอาจารย์เดิมไว้ ห้องหนึ่งใช้กับหลายวิชาได้เมื่อเวลาไม่ทับซ้อน และวิชาหนึ่งจัดสอบได้หลายห้อง

## รันเว็บใน Docker

หลังตั้งฐานข้อมูลและสร้างผู้ดูแลตามขั้นตอนด้านบนแล้ว สามารถรัน Next.js ใน container แทน `npm run dev` ได้

สร้าง `.env.app.local` โดยใส่ค่า secret เดียวกับ `.env.local`:

```dotenv
BETTER_AUTH_SECRET=ใส่ค่าสุ่มที่ตั้งไว้
```

หยุด `npm run dev` ก่อนเพื่อคืนพอร์ต 3000 แล้วรัน:

```bash
docker compose -f compose.yaml -f compose.app.yaml up -d --build web
docker compose -f compose.yaml -f compose.app.yaml logs -f web
```

เว็บเปิดที่ [localhost:3000](http://localhost:3000) และใช้ฐานข้อมูลกับไฟล์ local ชุดเดิม หลังแก้ schema ให้รัน `npm run db:migrate` ก่อนเปิดเว็บรุ่นใหม่ เพราะ local Compose ไม่รัน migration ให้โดยอัตโนมัติ

## ติดตั้งบนเซิร์ฟเวอร์

ใช้ `compose.production.yaml` ซึ่งรัน Next.js, PostgreSQL, MinIO และ Caddy พร้อม HTTPS ต้องมี Linux server, Docker Compose และ DNS สำหรับโดเมนเว็บกับโดเมนไฟล์

1. คัดลอก `.env.docker.example` เป็น `.env.docker`
2. ตั้งโดเมนให้ชี้เซิร์ฟเวอร์ และแก้ secret/รหัสผ่านทุกค่าตาม [คู่มือติดตั้ง](docs/SETUP.md#3-ตัวแปร-production)
3. ตั้ง Gmail OAuth2 หากต้องการส่งอีเมลจริง
4. เปิดระบบและสร้างผู้ดูแลคนแรก:

```bash
docker compose --env-file .env.docker -f compose.production.yaml up -d --build
docker compose --env-file .env.docker -f compose.production.yaml --profile tools run --rm seed-admin
docker compose --env-file .env.docker -f compose.production.yaml ps
```

Production Compose รัน migration ก่อนเปิดแอป ฐานข้อมูลและไฟล์เก็บใน Docker volumes บนเซิร์ฟเวอร์ โดยใช้ชื่อ volume ต่างจาก local การย้ายข้อมูลเดิมต้องทำตาม [คู่มือติดตั้ง](docs/SETUP.md) และไม่เกิดขึ้นจากการสลับ Compose โดยอัตโนมัติ

เมื่ออัปเดตโค้ดบนเซิร์ฟเวอร์:

```bash
git pull --ff-only
docker compose --env-file .env.docker -f compose.production.yaml up -d --build
```

> **ข้อมูลสำคัญ:** เก็บ `.env` และไฟล์ข้อสอบไว้นอก Git การหยุด container ด้วย `docker compose down` ยังรักษา volumes แต่ `down -v` ลบข้อมูล ระบบไม่มีสำรองอัตโนมัติ และ Factory Reset กู้คืนไม่ได้

## เปิดดูฐานข้อมูล

ขณะ PostgreSQL ทำงาน ให้รันจากโฟลเดอร์โปรเจกต์:

```bash
npm run db:studio
```

เปิด **[https://local.drizzle.studio](https://local.drizzle.studio)** และเปิด terminal นี้ค้างไว้ เลือก schema `app` เพื่อดูข้อมูลข้อสอบ หรือ `better_auth` เพื่อดูบัญชีและ session

ถ้าค้างที่ Connecting ใน Chrome/Edge ให้เปิด Site information ข้าง URL แล้วอนุญาต **Apps on device / Local network access** จากนั้นโหลดหน้าใหม่ Studio ใช้สิทธิ์ฐานข้อมูลโดยตรง จึงควรใช้งานเฉพาะในเครื่องหรือผ่าน SSH tunnel

## คำสั่งสำหรับพัฒนาและทดสอบ

| คำสั่ง | หน้าที่ |
| --- | --- |
| `npm run dev` | เปิดเว็บพร้อมโหลดการแก้ไขระหว่างพัฒนา |
| `npm run lint` | ตรวจรูปแบบและข้อผิดพลาดในโค้ด |
| `npm run test` | รัน unit tests; integration tests ทำงานเมื่อกำหนดฐานข้อมูลทดสอบ |
| `npm run build` | ตรวจ TypeScript และสร้างแอปสำหรับ production |
| `npm run check` | รัน lint, tests และ build ตามลำดับ |
| `npm run db:generate` | สร้าง migration จากการแก้ schema เพื่อให้ตรวจทานก่อนใช้ |
| `npm run db:migrate` | ใช้ migration ที่อยู่ใน repository |
| `npm run db:studio` | เปิดตัวเชื่อมต่อ Drizzle Studio |

ทดสอบ browser ด้วย Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

การทดสอบที่ต้องเข้าสู่ระบบหรือสร้างข้อมูลต้องมีบัญชีและ environment ทดสอบ โดยอ่าน [ผลและเงื่อนไขการทดสอบ](docs/UI_REVIEW.md) ก่อน ใช้ฐานข้อมูลแยกสำหรับ integration/E2E เพื่อไม่ให้ข้อมูลจริงปะปนกับชุดทดสอบ

## โครงสร้างโปรเจกต์

```text
src/app/             หน้าเว็บและ API ของ Next.js
src/components/      ฟอร์ม เมนู และ UI ที่ใช้ร่วมกัน
src/actions/         การทำงานฝั่งเซิร์ฟเวอร์
src/db/schema/       schema ของ Better Auth และระบบข้อสอบ
src/lib/             สิทธิ์ สถานะ ไฟล์ อีเมล และเครื่องมือร่วม
drizzle/             SQL migrations และ metadata
infrastructure/      การตั้งค่า private bucket และสิทธิ์ MinIO
scripts/             สร้างผู้ดูแลและเครื่องมือเตรียมข้อมูลทดสอบ
tests/               unit, integration และ E2E tests
public/              โลโก้และฟอนต์สำหรับเว็บ/PDF
docs/                Requirements, ERD, Data Dictionary และคู่มือติดตั้ง
```

ฐานข้อมูลมี **16 ตารางของระบบ**: `better_auth` 4 ตาราง และ `app` 12 ตาราง ไฟล์ข้อสอบและใบปะหน้าอยู่ใน private MinIO ส่วน PostgreSQL เก็บ metadata และเวอร์ชันไฟล์

## เอกสารเพิ่มเติม

| เอกสาร | เนื้อหา |
| --- | --- |
| [การตั้งค่าและติดตั้ง](docs/SETUP.md) | Environment, Docker, HTTPS, migration และการดูแลข้อมูล |
| [Requirements](docs/REQUIREMENTS.md) | ขอบเขตระบบและกติกาธุรกิจล่าสุด |
| [Data Dictionary](docs/DATA_DICTIONARY.md) | ตาราง คอลัมน์ ชนิดข้อมูล และข้อจำกัด |
| [ERD](docs/ERD.md) | ความสัมพันธ์ระหว่างตาราง |
| [แนวทาง UI/UX](docs/UX_GUIDELINES.md) | การจัดหน้าตามขั้นตอนงานและรูปแบบส่วนติดต่อ |
| [การทดสอบหน้าจอ](docs/UI_REVIEW.md) | ผลทดสอบและเงื่อนไขของ environment ทดสอบ |
