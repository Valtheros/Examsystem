# คู่มือฐานข้อมูลและภาพ ERD - 4 ตุลาคม 2569

ไฟล์ผลลัพธ์อยู่ที่ `output/pdf/exam-database-2026-10-04-erd.png` และ `output/pdf/exam-database-2026-10-04-guide.pdf` ภาพเดิมเป็นขาวดำ 3000 × 3200 pixels ใช้สี่เหลี่ยมกับข้าวหลามตัด คำสั่งแก้ไขล่าสุดเปลี่ยนเฉพาะ PDF เป็น 19 หน้า A4 ใช้ TH SarabunPSK ฝังในไฟล์ เหลือเฉพาะหน้าที่ของแต่ละตาราง Attribute ความสัมพันธ์พร้อมเหตุผล และที่มาของตารางกลาง M:N ไม่มีหน้าปก ภาพ ERD ตัวอย่าง หรือส่วนอธิบายอื่นใน PDF

## หลักฐานและขอบเขต

- อ่าน metadata ของ PostgreSQL Docker จริงใน transaction แบบ read-only ไม่ export แถวข้อมูลธุรกิจ บัญชี credential session token หรือไฟล์ข้อสอบ
- พบ `app` 12 ตาราง + `better_auth` 4 ตาราง และ FK 24 จุด; migration ที่ใช้แล้ว 6 รายการ ตาราง `drizzle.__drizzle_migrations` ไม่นับรวมเป็นตารางธุรกิจ
- อธิบาย 16 ตารางและ Attribute ครบ 178 คอลัมน์เป็นตาราง ชนิดข้อมูลจาก catalog และ Foreign Key ครบ 24 จุด โดยแสดงความสัมพันธ์ที่เกี่ยวข้องในหัวข้อของแต่ละตาราง
- `exam_rooms` รองรับ subjects M:N rooms; `request_rooms` เชื่อม exam_requests M:N exam_rooms ในประวัติคำขอ พร้อม snapshot รายห้อง ไม่ใช่การอนุญาตหลายคำขอที่ไม่ยกเลิกพร้อมกันในวิชาเดียว
- แสดง `exam_requests` กับ `print_jobs` แบบสูงสุด 1:1 ตาม UNIQUE ไม่ใช่ 1:N; Subject-Request เป็นประวัติ 1:N แต่มี partial UNIQUE สำหรับคำขอที่ยังไม่ยกเลิก
- `verifications` ไม่มี FK ไป users; ไม่เพิ่ม self-loop ของ users.created_by หรือเส้น FK จาก audit_logs.target_id ที่ฐานข้อมูลไม่ได้บังคับ
- แยกเส้นที่อ้าง users เป็นแผนภาพย่อยในภาพเดียวเพื่อให้อ่านง่าย users ที่แสดงซ้ำหมายถึงตารางเดียวกัน ไม่ใช่ตารางใหม่
- `deliveries` และ `distributions` ถูกลบไปแล้ว ไม่อยู่ใน ERD ปัจจุบัน

## วิธีสร้างซ้ำ

```powershell
node scripts/inspect-database-for-report.mjs
python scripts/build-database-report.py
pdftoppm -r 110 -png output/pdf/exam-database-2026-10-04-guide.pdf tmp/pdfs/database-report/revised
python scripts/verify-database-report.py
```

ใช้ Python runtime ที่มี ReportLab, uharfbuzz, pypdf และ Pillow พร้อม Poppler สคริปต์ใช้ฟอนต์ TH SarabunPSK จาก `../outputs/ui-report/assets` ค่าเริ่มต้นแก้ PDF เท่านั้น หากต้องสร้าง PNG เดิมซ้ำ ให้เพิ่ม `--erd` ในคำสั่ง builder หากย้ายเครื่อง ให้ปรับตำแหน่ง runtime/font ใน builder ไม่จำเป็นต้องแก้ฐานข้อมูล เอกสารนี้เป็น snapshot ของวันที่ระบุ หาก schema เปลี่ยน ให้ตรวจเนื้อหาและปรับวันที่ก่อนสร้างฉบับใหม่

## การตรวจคุณภาพ

- ชุดชื่อ 16 ตารางและชุด FK ทั้ง 24 จุดในคำอธิบายตรงกับ catalog ทุกจุด ไม่มีรายการที่ขาดหรือเกิน
- ตรวจ UNIQUE ของ print_jobs.request_id ก่อนสร้างภาพ
- ตรวจ geometry ว่ากล่องตัวเลข 1/N ไม่ตัดกับเส้นสัมพันธ์
- ตรวจตัวอักษรทุกตัวที่เขียนให้มีในฟอนต์ ใช้ `->` แทนลูกศร Unicode ที่ TH SarabunPSK ไม่รองรับ
- PDF มี 19 หน้าและ 178 Attribute ชื่อตาราง/คอลัมน์ FK ปรากฏครบ ฝังเฉพาะ TH SarabunPSK Regular/Bold ตรวจภาพที่เรนเดอร์ครบทุกหน้า ไม่มีหัวข้อค้างหน้าหรือหน้าต่อที่มีเพียงบรรทัดเดียว
- `npm run lint` ผ่าน งานนี้ไม่แก้โค้ด Next.js หรือ production behavior จึงไม่ build/redeploy เว็บหรือทำ migration เพิ่ม
