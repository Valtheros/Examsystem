# ตรวจและปรับการใช้งานระบบจัดพิมพ์ข้อสอบ

## รอบสอบและหน้าจัดเตรียมสอบ — 5 ตุลาคม 2569

- เพิ่มแก้ไข/ลบรอบสอบพร้อม Audit Log ใน transaction; ป้องกันข้อมูลที่มีคำขอแม้ยกเลิกแล้ว และทดสอบกรณีสร้างคำขอพร้อมลบรอบสอบจริงบน PostgreSQL
- หน้ารอบสอบ ห้อง รายวิชา และตารางสอบแสดงรายการก่อน เปิดฟอร์มเมื่อต้องใช้ ปุ่มจัดการตรงแนวเดียวกัน เหตุผลที่ล็อกเปิดอ่านผ่าน AlertDialog ไม่ทำให้แถวตารางสูงผิดปกติ
- มือถือรวมข้อมูลรองไว้ใต้รายการและย่อปุ่มเป็นไอคอนที่มี accessible name; ปุ่มแก้ไข/ลบไม่หลุดออกนอกจอ ตรวจภาพโหมดสว่าง/มืดและฟอร์มรอบสอบ 360px
- `npm run lint`, `npm run build` และ production build ใน Docker ผ่าน; unit 62 + integration 6 รวม 68 tests ผ่านบนฐานข้อมูลทดสอบแยก
- Playwright workflow 4 บทบาทผ่าน 44.9 วินาทีบน Chromium ครอบคลุมสร้าง/แก้ไข/ยกเลิกการลบ/ลบรอบสอบ ห้อง วิชา ตารางสอบ ส่งกลับคำขอ เปลี่ยนไฟล์ สร้างใบปะหน้า และจบงานพิมพ์ รวมตรวจ viewport 360/768/1024/1440, เปิดเหตุผลที่ล็อก และกด Enter เพื่อแก้ไขห้อง
- อัปเดตเฉพาะ web container ไม่รัน seed/reset/migration กับข้อมูลจริง ตรวจจำนวนบัญชี รอบ วิชา คำขอ ไฟล์ ใบปะหน้า งานพิมพ์ และ fingerprint รหัสผ่านก่อน/หลังเท่ากัน ใช้ volumes เดิมและ `restart: no`; `/api/health` ตอบ ok
- ภาพทดสอบอยู่ `output/playwright/` และ `test-results/` ไม่ commit บัญชีหรือข้อมูลทดสอบ รอบนี้ไม่ทดสอบ Firefox/Safari, เครื่องพิมพ์จริง หรือโหลดผู้ใช้พร้อมกัน

## รุ่นปัจจุบัน 3 ตุลาคม 2569

จบงานที่พิมพ์เสร็จแล้ว ยกเลิก UI/Server Action ส่งมอบและหน้า/API QR แจกจ่าย ไม่ลบข้อมูลเก่า รอบสอบใช้ dropdown กลางภาค/ปลายภาค/อื่น ใบปะหน้าตามแบบ PSU พร้อม public/images.png และช่องผู้คุมสอบกรอกเอง ไม่มี QR ข้อมูลการทดสอบรุ่นก่อนด้านล่างเป็นประวัติ ไม่ใช่ workflow ปัจจุบัน

ผลตรวจรุ่นนี้:

- ESLint ผ่าน; Vitest รันทีละ worker ผ่าน 35 ข้อ และ integration ที่รันแยกกับ PostgreSQL ผ่าน 3 ข้อ
- Production build ผ่านใน Docker Node.js 22; เส้นทางส่งมอบและ API สแกนไม่อยู่ใน build แล้ว
- Playwright กับ production Docker image บนฐานข้อมูลทดสอบ: 19 ผ่าน / 1 ข้าม (workflow เต็มบน mobile project ข้ามไว้เดิม) ครบ 4 บทบาท รวมส่งกลับแก้ไข จำนวนสองห้อง ใบปะหน้าหลายรุ่น และจบที่พิมพ์เสร็จ
- ตรวจ dropdown กลางภาค/ปลายภาค/รอบสอบอื่น พร้อมกรอกชื่ออื่น; ตรวจไม่มีปุ่มส่งมอบหรือเมนูรับมอบ/แจกจ่าย และ API สแกนเดิมตอบ 404
- ตรวจ PDF ที่สร้างผ่านระบบจริงด้วยภาพ: A4 โลโก้ PSU จำนวนหลัก/สำรอง/รวมตรงกัน ช่องสำหรับวันสอบว่าง ไม่มี QR; ข้อความยาวมีหน้ารายละเอียดต่อโดยไม่ทับช่องลายเซ็น
- ตรวจหน้าคำขอที่ 360/768/1024/1440 พิกเซล ไม่มี horizontal overflow งานเสร็จอยู่เหนือส่วนประวัติ
- ใช้ examsystem_test_workflow_0913 และ exam-files-workflow-test แยกจากข้อมูลจริง ไม่เรียก Factory Reset และไม่ลบ volumes

ข้อจำกัดการตรวจ: ไม่ได้ทดสอบ Firefox/Safari จริง โหลด 200 คน ไฟล์เต็ม 100 MB หรือเครื่องพิมพ์จริง Native Windows build พบไฟล์ types ที่สร้างใน cache ของ dev server ไม่สมบูรณ์ จึงใช้ผล clean production build และ browser verification จาก Docker ซึ่งเป็นสภาพแวดล้อมใช้งานจริง ไม่ปิดการตรวจ TypeScript หรือ ESLint เพื่อให้ผ่าน

## ปรับ UX เป็นงานเรียงลำดับ — 13 กันยายน 2569 (ประวัติรุ่นก่อน)

ออกแบบใหม่ตาม docs/UX_GUIDELINES.md หลังผู้ใช้แจ้งว่าปุ่มและคอลัมน์เดิมทำให้สับสน:

- หน้าคำขอทุกบทบาทเป็นคอลัมน์เดียว งานปัจจุบันมาก่อน แบบฟอร์มย้อนหลัง/ไฟล์/ประวัติพับด้านล่าง
- หน่วยโสตเห็นปุ่มหลักตามขั้น: ยืนยันแผน → สร้างใบปะหน้า → เริ่มพิมพ์ → จัดซอง → ส่งมอบ ไม่แสดงปุ่มพิมพ์ซ้ำบนหน้าส่งมอบ
- รายการคำขอใช้ลิงก์ทั้งแถวแทนปุ่ม เปิด แยก รองรับ keyboard และ native link behavior
- หน้าหลักเป็นรายการงานแนวตั้ง สถิติอยู่ส่วนรอง จัดตารางสอบจากบนลงล่าง ผู้ดูแลเปิดชุดคำสั่งเฉพาะบัญชีที่เลือก และหน้ารับมอบเน้นซองค้างส่ง
- ปรับคำแนะนำที่ยังอ้างชื่อตาราง/hard-code/บังคับไฟล์พร้อมพิมพ์ให้เป็นภาษางานจริง ใช้ความกว้างและพื้นหลังเรียบสม่ำเสมอ
- lint, TypeScript, Vitest 31 และ build ผ่าน; Playwright workflow/4-role UI 17 ผ่าน 1 ข้าม และ regression UX เพิ่ม 2 ผ่าน (รวม 19 ผ่าน 1 ข้าม)
- linear-ux.spec.ts ตรวจคลิก/Enter เปิดแถว, หน้าส่งมอบมีปุ่มหลักเดียว, ไม่แสดงปุ่มพิมพ์ซ้ำ, ประวัติอยู่ด้านล่างและพับเริ่มต้น ตรวจ 360/768/1024/1440 พร้อมภาพจริง
- ทดสอบบนฐานข้อมูล examsystem_test_workflow_0913 / bucket exam-files-workflow-test แยกจากจริง ไม่มี migration หรือ reset ในรอบปรับ UX นี้
- ตรวจ Docker image จริงเพิ่มด้วย usability + linear-ux บน desktop/mobile ผ่านครบ 10 รายการ; อัปเดตเฉพาะ container web ที่ http://localhost:3000 และ health เป็น healthy โดยรักษา volumes เดิม

รายละเอียดรอบก่อนด้านล่างเก็บเป็นประวัติ ไม่ใช่รูปแบบหน้าจอปัจจุบัน

## สิ่งที่แก้

- ช่องเลือกข้อมูลเต็มความกว้างและตัดชื่อยาวในช่องแสดงผล เมนูมือถือปิดหลังเลือกหน้า
- ภาพรวมมีทางลัดงานตามบทบาท และฟอร์มที่ยังไม่มีข้อมูลตั้งต้นอธิบายขั้นตอนถัดไป
- หน้าคำขอค้นหาเลขคำขอ วิชา ผู้ส่ง รอบสอบ และกรองสถานะได้จริง โดยยังกรองสิทธิ์อาจารย์ฝั่ง server
- เปลี่ยนข้อความเชิงฐานข้อมูลเป็นคำแนะนำใช้งาน และแสดงข้อผิดพลาดของฟอร์มในหน้าเดิม
- แก้การเปลี่ยนสถานะที่ไม่มีหมายเหตุ: แปลง FormData null เป็นข้อความว่างก่อน validation
- แก้ MinIO ปฏิเสธ PUT เนื่องจาก metadata header ไม่ถูกเซ็น โดยเซ็น SHA-256 header ที่ browser ส่งจริงและระบุ checksum ล่วงหน้า
- เจ้าหน้าที่เปิดรายละเอียดจากรายการส่งมอบ และเปิดหน้าบันทึกแจกจ่ายรายห้องได้โดยตรง นอกเหนือจากสแกน QR; endpoint ยังคงตรวจบทบาทและสถานะ
- แสดงเวลาในประวัติคำขอด้วย Asia/Bangkok และแจ้งปัญหาการเชื่อมต่อ/ล็อกอินถี่เกินไปเป็นภาษาไทย

## ชุดทดสอบที่เพิ่ม

- `src/actions/workflow-feedback.test.ts`: validation, success และไม่ส่งรายละเอียด error ภายในไปหน้าเว็บ
- `src/lib/storage.test.ts`: ตรวจ headers ของ presigned upload
- `tests/e2e/usability.spec.ts`: 4 บทบาท บน desktop และ viewport 360px; เมนูมือถือ การค้นหา/ล้างตัวกรอง และไม่ล้นหน้าจอ
- `tests/e2e/request-review.spec.ts`: ตั้งรอบ/ห้อง/วิชา → คำขอ → ป้องกันส่งโดยไม่มีไฟล์ → PDF จริงไป MinIO → ตัด → ไฟล์พร้อมพิมพ์ → ใบปะหน้า → พิมพ์ → ส่งมอบ → แจกเข้าห้อง

ทดสอบบนฐานข้อมูล Docker local ด้วยข้อมูลชื่อ `ทดสอบ UI` ไม่ได้ล้างข้อมูลเดิม ทุกครั้งที่รัน workflow test จะเพิ่มข้อมูลทดสอบใหม่

สร้างบัญชีทดสอบเฉพาะ local ด้วย `npx tsx scripts/seed-review.ts` โดยตั้ง `DATABASE_URL` ของ local และ `REVIEW_PASSWORD` เอง ห้ามใช้บน production และห้าม commit รหัสผ่าน บัญชีที่สร้างมี prefix `review.`

เมื่อมีเว็บ local เปิดอยู่ ให้ตั้ง `PLAYWRIGHT_BASE_URL=http://localhost:3000` และ `REVIEW_PASSWORD` แล้วรัน `npm run test:e2e` ชุดทดสอบเคารพ rate limit ของระบบ ไม่ปิดการป้องกันเพียงเพื่อให้ทดสอบผ่าน

## ขอบเขต

การตรวจรอบนี้ไม่ใช่การรับรอง production ทั้งระบบ ยังไม่ได้ทดสอบโหลด 200 คน ไฟล์เต็มขนาด 100 MB, Safari/Firefox จริง หรือ Factory Reset ในรอบนี้

อ้างอิงการเซ็น header: [AWS SDK presigner](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner)

## ตรวจการแจ้งเตือนและกล่องยืนยัน

- ตรวจ source ทั้ง `src`: native `window.confirm` เดิมมี 1 จุดที่เข้าใช้งานแทน เปลี่ยนเป็น shadcn AlertDialog แล้ว ไม่มีการเรียก native alert/confirm/prompt เหลืออยู่ตาม AST regression test
- เข้าใช้งานแทน: แสดงบัญชีเป้าหมายและเตือนว่ามีผลจริง, ยกเลิก/Escape ได้ก่อนส่ง, ป้องกันกดซ้ำขณะส่ง และคงข้อผิดพลาดไว้ใน dialog เพื่อให้ลองใหม่
- ผลสำเร็จของฟอร์มส่วนกลางใช้ Sonner toast ปิดได้ ไม่แจ้งซ้ำจาก rerender; validation และคำเตือนสถานะยังแสดงเป็น shadcn Alert เพื่อให้อ่านค้างไว้ได้
- Factory Reset: เพิ่ม AlertDialog ยืนยันครั้งสุดท้าย, แยก success/error/ไฟล์ตกค้าง และรักษาโหมดล้างเฉพาะไฟล์เมื่อ retry ล้มเหลว
- ตรวจการแจ้งผลอัปโหลดไฟล์ สร้างใบปะหน้า ส่งอีเมลซ้ำ login และแจกข้อสอบ: เดิมใช้ toast/shadcn Alert อยู่แล้ว ไม่ใช่ native browser dialog
- ตรวจตาม skill React: ไม่เปลี่ยนสิทธิ์ฝั่ง server, ป้องกัน duplicate submission, dialog มี title/description และ focus ไปปุ่มยกเลิก

ผลตรวจรอบนี้: lint และ production build ผ่าน; Vitest 27 tests ผ่าน; Playwright ทั้งชุด 17 ผ่าน / 1 ข้าม (workflow เต็มบนมือถือข้ามไว้เดิม แต่รันบน desktop ผ่าน) ทดสอบ dialog/toast บน Chromium desktop และ mobile emulation พร้อมตรวจ screenshot, ยกเลิก, Escape, ปุ่มปิด toast, ไม่มี native dialog และไม่มี page error ในกรณี feedback

Factory Reset ทดสอบ UI และ response branches ด้วย mock เท่านั้น ไม่ได้ล้างฐานข้อมูลหรือไฟล์จริงจากการทดสอบนี้ ส่วน workflow E2E เพิ่มข้อมูลทดสอบใหม่ตามปกติ ยังไม่ใช่การรับรอง Safari/Firefox จริงหรือทุก network failure ของระบบ

## ผลปรับ workflow — 13 กันยายน 2569 (ใช้แทนรายละเอียด workflow เก่าด้านบน)

- เจ้าหน้าที่จัดห้อง/ความจุและตาราง ไม่กรอกจำนวนข้อสอบ; ล็อกเมื่อมีคำขอ และตรวจเวลาทับซ้อนแม้บันทึกพร้อมกัน
- อาจารย์ใช้ wizard 3 ขั้น กรอก structured form + จำนวนต่อห้อง + PDF; ไม่มีต้นฉบับกระดาษ ร่างและข้อผิดพลาดคงข้อมูลไว้
- หน่วยโสตดูต้นฉบับขณะรอตรวจได้ ใช้พิมพ์ได้ทันที; กำหนดหลัก/สำรอง โดยยอดอาจารย์ไม่เปลี่ยน; บันทึกเหตุผล รุ่นแผน และล็อกหลังเริ่ม
- ใบปะหน้า PDF A4 ไทยขาวดำถูกตรวจภาพจริง จำนวนตรงกับงานพิมพ์ ช่องสำหรับวันสอบเว้นว่าง และมี QR ที่ต้องเข้าสู่ระบบ การสร้างใหม่ไม่ลบรุ่นเก่า
- รายการส่งมอบแยกห้อง/วันสอบ มีทางเข้าบันทึกแจกจ่าย และการสแกนซ้ำไม่สร้างรายการซ้ำ
- ผู้ดูแลมีกรองบทบาท แยกเมนูจัดการระบบ คง impersonation; ยกเลิกคำขอมี AlertDialog ไม่ใช้ native confirm

### ผลตรวจที่รันจริง

- npm run lint ผ่าน; TypeScript และ npm run build ผ่านทั้งบน Windows และ Docker image
- npm run test: 31 ผ่าน; integration 3 รายการ opt-in ข้ามในคำสั่งทั่วไป แล้วรันแยกกับ PostgreSQL จริงผ่านครบ 3
- Migration test ใช้ฐานข้อมูลว่างชื่อ examsystem_test_workflow_0913: ติดตั้ง schema เดิม+fixture ก่อน migration 0004 และตรวจยอด 30+2=32, สถานะเดิม, selected file ไม่เดาย้อนหลัง และ 18 ตาราง ผ่าน
- Integration: บันทึกจองห้องพร้อมกัน, จำนวน/ความจุ, ส่งเมื่อไม่มี PDF, ไฟล์ล่าสุด, ยอดหลักต่างจากยอดอาจารย์, เหตุผล, revision ใบปะหน้า, ล็อกหลังพิมพ์, ส่งมอบ, audit/history และ soft cancellation เก็บไฟล์ ผ่าน
- Playwright ทั้งชุด: 17 ผ่าน / 1 ข้าม (workflow เต็มบน mobile project ข้าม; workflow เดสก์ท็อปครบ 4 บทบาทและสองห้องผ่าน)
- UI ทุกบทบาทบน desktop/mobile ผ่าน ฟอร์มอาจารย์ตรวจ viewport 360/768/1024/1440 และภาพ PDF ด้วยสายตา
- Production Docker image ทดสอบ login/หน้าใช้งาน/ค้นหาทั้ง 4 บทบาทเพิ่มเติมกับฐานข้อมูลทดสอบ ผ่าน 4 รายการ
- ข้อมูลทดสอบทั้งหมดของรอบนี้อยู่ฐานข้อมูล examsystem_test_workflow_0913 และ bucket exam-files-workflow-test แยกจากข้อมูลจริง ไม่เรียก Factory Reset จริง
- ฐานข้อมูลจริงหลัง migration ยังคงผู้ใช้ 7, คำขอ 8, ห้องคำขอ 8, ยอดพิมพ์รวม 238, ไฟล์ข้อสอบ 7, ใบปะหน้า 3, งานพิมพ์ 3, audit 171 เท่าเดิม
- เว็บ Docker จริงใช้ volumes เดิม เปิด http://localhost:3000 และ /api/health ตอบ ok

### รันทดสอบซ้ำอย่างปลอดภัย

ใช้ฐานข้อมูล local ใหม่ชื่อขึ้นต้น examsystem_test_ เท่านั้น ตั้ง TEST_DATABASE_URL และ DATABASE_URL ให้ตรงกัน เรียก scripts/prepare-workflow-test.ts เฉพาะฐานข้อมูลว่าง (สคริปต์ปฏิเสธ schema ที่มีอยู่ ไม่ reset) จากนั้น seed-review.ts ด้วย REVIEW_PASSWORD ที่ตั้งเอง แยก STORAGE_BUCKET สำหรับ test และรัน tests/workflow.integration.test.ts; Playwright ใช้ PLAYWRIGHT_BASE_URL ของเว็บที่เชื่อม test DB เท่านั้น

ข้อจำกัด: ไม่ได้ทดสอบ Firefox/Safari จริง, โหลด 200 คน, อัปโหลดเต็ม 100 MB หรือเครื่องพิมพ์จริง ไม่อ้างผลว่าเงื่อนไขเหล่านี้ผ่าน การส่งเมลใช้ Mailpit ในเครื่อง ไม่ได้ส่ง Gmail จริง ไม่มีระบบสำรองอัตโนมัติและไม่ได้รีเซ็ตข้อมูลจริง

## Visual redesign — 3 ตุลาคม 2569

- ใช้ design-taste-frontend กับระบบงานจริง: ลดการ์ดซ้อนเป็น section เส้นแบ่ง งานของบทบาทเป็นลิงก์แถวเต็ม สถิติเป็นข้อมูลรอง ไม่ใช้ gradient/glass/เงาใหญ่ และคงงานเรียงบนลงล่าง
- โหมดสว่างเริ่มต้นและโหมดมืดจำค่าบนอุปกรณ์ มีปุ่มสลับที่ header ใช้ Noto Sans Thai และ PSU navy เดิม
- โลโก้บนเว็บเป็น PNG โปร่งใส ดู prompt/ต้นฉบับ/วิธีสร้างใน `LOGO_ASSET.md` ไม่เขียนทับภาพที่ PDF ใช้ หน้า login ไม่แสดงบรรทัดคณะวิทยาศาสตร์ตามคำสั่งล่าสุด
- เพิ่ม loading/error/empty state, skip link และเป้าสัมผัสหลัก 44px; ฟอร์มอาจารย์ย้าย focus ไปต้นขั้นและรอ hydration ก่อนให้เลือกไฟล์ พร้อมแสดงชื่อ PDF ที่เลือก
- ตรวจ React: theme ไม่ render markup ต่างกันระหว่าง SSR/client, hydration suppression จำกัดที่ html, สิทธิ์และข้อมูลอยู่ฝั่ง server เดิม ไม่เพิ่ม fetch ฝั่ง client แทนข้อมูล server
- เปิด Drizzle Studio จริงและเลือก schema `app` เห็น 14 ตาราง; `better_auth` อีก 4 ตาราง ไม่มี custom database UI และไม่ใช้ Prisma/Adminer ในรุ่นนี้ Chrome อาจต้องอนุญาต Local network access ตาม SETUP

ผลตรวจล่าสุด:

- ESLint ผ่าน; unit 43 ผ่าน (integration 3 รายการข้ามในคำสั่งปกติ แล้วรันแยกผ่านทั้ง 3)
- Native production build และ Docker production build ผ่าน อัปเดตเฉพาะ container web โดยไม่ลบ volumes
- Playwright ทั้งชุด 19 ผ่าน / 1 ข้าม: workflow เต็มบน desktop ครบ 4 บทบาท สองห้อง PDF v1/v2 ส่งกลับแก้ไข จำนวนพิมพ์ revision ใบปะหน้า และจบเมื่อพิมพ์เสร็จ; mobile workflow เต็มข้ามตามเดิม แต่ navigation/filter/dialog ของทั้ง 4 บทบาทบนมือถือผ่าน
- ตรวจ screenshot และไม่มี horizontal overflow ที่ 360/768/1024/1440 ในฟอร์มอาจารย์และหน้าคำขอ ตรวจ light/dark หน้าของหน่วยโสตและ login เพิ่ม พร้อมทดสอบจำ theme หลัง reload
- ตรวจหน้า login Docker จริง: โลโก้โปร่งใส ไม่มีข้อความคณะวิทยาศาสตร์ใน body และ `/api/health` ตอบ `ok`
- ข้อมูลจริงก่อน/หลัง: users 4, requests 1, files 1, cover_sheets 1, print_jobs 1 เท่าเดิม; ทดสอบ mutation ทั้งหมดใช้ฐานข้อมูลและ bucket แยก ไม่มี Factory Reset จริง
- ชุดทดสอบแก้ให้รอ sign-out/ส่งคำขอเสร็จจริง ไม่ถือว่าปุ่มเปลี่ยนข้อความเป็นผลสำเร็จ และเผื่อเวลาส่งอีเมล Mailpit โดยไม่ปิด rate limit

ข้อจำกัด: ไม่ได้ทดสอบ Firefox/Safari จริง, โหลด 200 คน, PDF เต็ม 100 MB หรือเครื่องพิมพ์จริงในรอบนี้ ผลข้างต้นไม่ใช่การรับรอง NFR เหล่านี้ `npm ci` รายงาน dependency advisories เดิม ต้องประเมินและอัปเดตเป็นงานแยก ไม่ใช้ audit fix แบบ breaking ระหว่าง redesign

## Database cleanup — 3 ตุลาคม 2569

- Migration `0005_retire_delivery_distribution` ลบเฉพาะ `deliveries` และ `distributions` ที่ workflow ปัจจุบันไม่ใช้ เหลือ 16 ตารางของระบบ (app 12 / better_auth 4) เก็บ migration journal ของ Drizzle ไว้
- ทดสอบบนฐานข้อมูลว่างแยก `examsystem_test_cleanup_20261003`: สร้างประวัติรับมอบ/แจกจ่ายเก่า ตรวจว่า archive ครบ รวม object key ลายเซ็นและผู้เกี่ยวข้อง แล้วจึงลบตาราง ยอดพิมพ์และสถานะเดิมไม่เปลี่ยน
- จำลอง view ที่อ้างตารางเดิม: DROP ถูกปฏิเสธ และทั้ง transaction รวม Audit Log ย้อนกลับ ผ่าน; migration ไม่ใช้ CASCADE
- ESLint ผ่าน, unit 43 ผ่าน / integration 3 ข้ามในคำสั่งปกติ, integration PostgreSQL แยกผ่าน 3 รายการ และ Docker production build ผ่าน ไม่มีการรัน Playwright ใหม่ในงานลดตารางรอบนี้
- ฐานข้อมูลจริง: สองตารางที่เลิกใช้มี 0 แถว ก่อน migration; หยุดเฉพาะ web ขณะย้าย ตรวจจำนวนและ fingerprint ของข้อมูลทั้ง 16 ตารางก่อน/หลังเท่ากันทุกตาราง (รวมบัญชี session Audit Log ไฟล์ คำขอ และงานพิมพ์) ไม่ใช้ Factory Reset และไม่แตะ MinIO/volumes
- Migration journal มี 6 รายการ รัน migrator ซ้ำสำเร็จโดยไม่เปลี่ยนข้อมูล; db:generate ไม่พบ schema ที่ยังตกค้าง
- เปิด web image ใหม่แล้ว container healthy, `/api/health` ตอบ ok และ `/login` ตอบ HTTP 200 รีสตาร์ต Drizzle Studio เพื่อโหลด schema ปัจจุบัน

## ล้างข้อมูลงานสอบโดยเก็บผู้ใช้ 5 ตุลาคม 2569

- เพิ่มปุ่มที่ภาพรวมผู้ดูแลและหน้า `/dashboard/reset` คงเมนู/URL Factory Reset เดิม แยกส่วนล้างงานสอบที่เก็บผู้ใช้กับส่วนรีเซ็ตทั้งระบบที่ลบผู้ใช้อื่น ไม่ใช้ตัวเลือก scope ที่สลับผิดได้ใน dialog เดียว
- ใช้หลัก preserve ของ design-taste-frontend บน shadcn/ui เดิม: PSU navy, section แบบเรียบ พื้นที่อ่านง่าย งานหลักอยู่บน คำเตือนชัด ช่องยืนยันเปิดเฉพาะเมื่อกด ตรวจ desktop/mobile โหมดสว่าง/มืดด้วยภาพจริง ไม่เพิ่ม dependencies
- `npm run lint`, native build และ Docker production build ผ่าน; Vitest 70 ผ่าน (unit 63 / PostgreSQL integration 7) บนฐานข้อมูลทดสอบ localhost ที่แยกจากระบบจริง
- Integration ตรวจสิทธิ์ 3 บทบาทที่ไม่ใช่ผู้ดูแล ข้อความ/รหัสผ่านผิด การล้าง 11 ตารางธุรกิจโดยคงทุกแถวใน auth 4 ตารางและ Audit Log, การกดซ้อน, lock ระหว่าง DB commit กับ Storage, Storage ล้มเหลว/retry และการป้องกัน retry ลบไฟล์เมื่อมีคำขอใหม่
- Playwright feedback 4 กรณีผ่านบน Chromium/mobile ใช้ mock endpoint เท่านั้น ตรวจทั้งสองขอบเขต ยกเลิกโดยไม่ส่ง request พิมพ์ข้อความไม่ตรงแล้วปุ่มปิด และคง error/ข้อมูลไว้ใน dialog ตรวจ 360/768/1024/1440px ไม่มีหน้าล้นแนวนอน ไม่มี native dialog หรือ browser error
- Workflow เดิมครบ 4 บทบาทตั้งแต่สร้างบัญชี/รอบ/สองห้อง ส่ง PDF ส่งกลับ แก้จำนวน/ใบปะหน้าจนพิมพ์เสร็จ ผ่าน 1 กรณี (47 วินาที) ใช้ database และ bucket ทดสอบแยก
- ทดสอบ HTTP จริงกับ Better Auth/PostgreSQL/MinIO เฉพาะชุดทดสอบ: ล้าง 11 ตารางและไฟล์ทดสอบ 6 ไฟล์สำเร็จ fingerprint ของ users/accounts/sessions/verifications ไม่เปลี่ยน Audit Log เก่าครบ ผู้ใช้ทั้ง 5 บัญชียังเข้าด้วยรหัสเดิมได้ ไม่เคยกดล้างข้อมูลงานสอบหรือ Factory Reset บนระบบที่ผู้ใช้ใช้อยู่
- ภาพตรวจอยู่ `output/playwright/clear-data-*` (ignored) ไม่ commit รหัสผ่าน บัญชีทดสอบ หรือไฟล์ข้อสอบ ไม่มี migration และไม่เปลี่ยน bootstrap/restart policy

ข้อจำกัด: ไม่ทดสอบ Firefox/Safari, โหลด 200 คน, การพิมพ์จริง หรือ Gmail จริงในรอบนี้ ไม่มีระบบสำรองอัตโนมัติ การล้างข้อมูลเป็นการลบถาวรตามขอบเขตที่ยืนยัน

## ปุ่มงานสำคัญและรหัสผ่าน 6 ตุลาคม 2569

- ใช้ design-taste-frontend แบบ preserve: คง layout บนลงล่างและ shadcn/ui เดิม แก้สีปุ่ม destructive/outline ที่ส่วนกลาง ไม่เพิ่มการ์ดหรือ dependencies; ปุ่มส่งกลับและยกเลิกเห็นทันที ไม่ซ่อนใน disclosure และปุ่มแก้ไฟล์/จำนวนมีขอบกับไอคอนชัดเจน
- นำรายการ “ขั้นตอนทั้งหมดของระบบ” ออกจากภาพรวม คงคำแนะนำขั้นตอนถัดไปและสิทธิ์เดิม
- บัญชีที่ยังต้องตั้งรหัสส่วนตัวแสดง “ตั้งรหัสผ่านชั่วคราว”; บัญชีที่ตั้งแล้วแสดง “แก้รหัสผ่าน” พร้อมช่องว่างสำหรับรหัสใหม่ ไม่แสดงรหัสเดิม การเปลี่ยนโดยผู้ดูแลยกเลิก session เดิมและบังคับผู้ใช้ตั้งรหัสส่วนตัวเมื่อเข้าอีกครั้ง
- ใบปะหน้าที่สร้างใหม่ดึงชื่ออาจารย์ปัจจุบันจากบัญชี ไม่เขียนทับ snapshot หรือ PDF เก่า ตรวจชื่อซ้ำก่อนบันทึกเพื่อปฏิเสธการเปลี่ยนชื่อระหว่างสร้างไฟล์อย่างปลอดภัย
- ESLint, native production build และ Docker production build ผ่าน; Vitest 74 ผ่าน (unit 66 / PostgreSQL integration 8) บนฐานข้อมูลทดสอบแยก ตรวจชื่อใหม่ รุ่นเก่าไม่เปลี่ยน และกรณีชื่อเปลี่ยนระหว่างสร้าง PDF ได้ 409 พร้อมลบเฉพาะ object ที่สร้างไม่สำเร็จ
- Playwright workflow ครบ 4 บทบาทผ่าน 1 กรณี รวมการเปลี่ยนชื่อและเปลี่ยนรหัสบัญชีทดสอบจริง; feedback/usability ผ่านอีก 12 กรณีบน Chromium/mobile ปุ่มยกเลิก ส่งกลับ และแก้แผนตรวจทั้งสองโหมดที่ 360/768/1024/1440px มีเป้าสัมผัสอย่างน้อย 44px และ contrast ข้อความอย่างน้อย 4.5:1 ไม่มี document overflow, native dialog หรือ browser error
- ตรวจภาพใบปะหน้า A4 ภาษาไทยด้วยสายตา: ชื่ออาจารย์ใหม่ปรากฏครบ จำนวนหลัก/สำรองตรงงานพิมพ์ ข้อความไม่ทับกัน และส่วนกรอกวันสอบยังเว้นว่าง ข้อมูลและรหัสผ่านที่เปลี่ยนในการทดสอบอยู่เฉพาะฐานข้อมูล/MinIO ชั่วคราว ไม่รีเซ็ตบัญชีจริงหรือรัน bootstrap ซ้ำ
- อัปเดตเฉพาะ Docker web ด้วย volumes เดิม `/api/health` ตอบ `ok`; ตรวจจำนวนข้อมูลจริงและ fingerprint รหัสผ่านก่อน/หลังเท่ากันทั้งหมด ลบเฉพาะ container และฐานข้อมูลทดสอบของงานนี้แล้ว

ข้อจำกัด: ไม่ทดสอบ Firefox/Safari, เครื่องพิมพ์จริง, Gmail จริง หรือโหลดผู้ใช้พร้อมกันในรอบนี้ ไม่มี migration และไม่เปลี่ยนนโยบาย restart/volumes

## ตรวจการแจ้งเตือนบนเว็บและ Gmail App Password — 6 ตุลาคม 2569

- ใช้ notifications/Nodemailer เดิม ไม่เพิ่มตารางหรือ dependency มีล่าสุด 3 รายการและกระดิ่ง Sheet สูงสุด 50 รายการ ไม่มี read_at/unread count; toast เฉพาะใหม่ polling จุดเดียวทุก 30 วินาทีหยุดเมื่อซ่อนแท็บ ไม่ refresh ฟอร์ม
- ESLint และ TypeScript ผ่าน; Vitest 84 ผ่าน (รวม PostgreSQL integration 10) ด้วย `npm run test -- --maxWorkers=2` บนฐานข้อมูล examsystem_test_notifications_20261006_1709 แยกจากจริง ลด workers เพื่อไม่ให้ password hashing ทดสอบเดิม timeout บนเครื่องนี้; Next.js build และ Docker production build ผ่าน
- ตรวจ rollback หลังเขียนสถานะ/ประวัติแล้วแต่ notification insert ล้มเหลว: ไม่มีสถานะ/ประวัติ/แจ้งเตือนค้าง ตรวจส่งซ้ำ/concurrent retry, attempts, Failed ไม่ย้อนสถานะ, Sent ไม่ส่งซ้ำ, ผู้รับ SMTP ไม่ accepted, App Password ไม่ครบไม่ fallback, OAuth2 เดิม และข้อความผิดพลาดไม่เปิดเผยรหัส SMTP
- Playwright ครบ 4 บทบาทผ่าน 1 กรณี: ส่งกลับพร้อมเหตุผล → ส่งใหม่ → รับงานและ toast ในแท็บอาจารย์ที่เปิดอยู่ → เริ่มพิมพ์ → พิมพ์เสร็จ; feed มี 4 เหตุการณ์ ไม่มีแจ้งเมื่ออาจารย์ส่งเอง และไม่คืน email_to/error/SMTP แม้ส่ง userId ใน URL ส่งเมลทดสอบจากหน้าผู้ดูแลสำเร็จถึง Mailpit แยก
- feedback/usability ผ่านอีก 12 กรณีบน Chromium/mobile; หน้าล่าสุด/Sheet ตรวจ 360/768/1024/1440px ทั้ง light/dark ไม่มี document overflow ตรวจภาพด้วยสายตาและ browser CLI เพิ่มเติม แก้การถ่ายภาพทดสอบให้รอ Sheet ปิดเสร็จ ไม่เก็บภาพระหว่าง animation
- ตรวจ API ไม่ login ได้ 401/no-store และอาจารย์กด retry ของผู้ดูแลได้ 403 ตรวจปุ่ม retry ไม่แสดงสำเร็จเมื่อ HTTP 200 แต่ ok=false ข้อมูลฟอร์มยังอยู่หลัง polling; ส่วนการทดสอบ reset ใช้การ intercept ไม่ส่งคำสั่งล้างจริง
- ภาพเก็บเฉพาะ local ใน output/playwright/notifications-20261006-1719 (ignored) ชุด MinIO ทดสอบใช้ tmpfs และ Mailpit ทดสอบแยก ลบเฉพาะ 3 container กับฐานข้อมูลทดสอบหลังตรวจเสร็จ ไม่ลบข้อมูล/volumes จริง
- อัปเดตเฉพาะ Docker web โดยไม่รัน setup/seed-admin ใหม่ เว็บ healthy และ /api/health ตอบ ok ตรวจจำนวนผู้ใช้/รอบ/คำขอ/ไฟล์/ใบปะหน้า/แจ้งเตือน/Audit และ fingerprint รหัสผ่านก่อน/หลังเท่ากันทั้งหมด ไม่ commit/push และไม่แก้ env จริง

ข้อจำกัด: ส่งจริงที่ทดสอบคือ SMTP ไป Mailpit ไม่ใช่ Gmail ขณะส่งมอบระบบจริงยัง MAIL_TRANSPORT=smtp และยังไม่มี App Password ต้องให้ผู้ใช้ใส่ env แล้วกดส่งเมลทดสอบและตรวจกล่องรับ/Spam ก่อนยืนยัน Gmail จริง ไม่มี worker/retry อัตโนมัติ ไม่มี Firefox/Safari/load test ในรอบนี้

## ขอบเขตเมลงานข้อสอบล่าสุด — 6 ตุลาคม 2569

- เมลงานข้อสอบส่งเฉพาะเมื่อพิมพ์เสร็จถึงอาจารย์เจ้าของคำขอ ไม่แจ้งคำขอใหม่/ยกเลิกถึงหน่วยโสต ไม่แจ้งพิมพ์เสร็จถึงเจ้าหน้าที่ และไม่ส่งเมลรับงาน/ส่งกลับ/เริ่มพิมพ์ แจ้งเตือน 4 เหตุการณ์บนเว็บกับเมลบัญชีคงเดิม
- กฎผู้รับตรวจที่ sendQueuedEmail ด้วย ทั้งการส่งอัตโนมัติและ retry: type พิมพ์เสร็จ และ user_id ตรง instructor_id เท่านั้น (ยกเว้นเมลบัญชี) ตรวจไม่ผ่านได้ EMAIL_DISABLED/409 ก่อนเพิ่ม attempts หรือเรียก SMTP ไม่ลบประวัติเก่า หน้าอีเมลไม่แสดงเหตุการณ์ Pending/Failed ที่ปิดส่งแล้ว แต่คงประวัติ Sent เดิม
- ESLint ผ่าน; unit/integration 90 รายการผ่าน บนฐานข้อมูล examsystem_test_email_policy_20261006 แยก ทดสอบ after() เรียกเฉพาะพิมพ์เสร็จ การเปลี่ยนสถานะล้มเหลวไม่ส่งเมล และ SQL ปฏิเสธการส่งใหม่ให้เจ้าหน้าที่/สถานะเริ่มพิมพ์โดยไม่เรียก SMTP; build ผ่าน ทดสอบ UI notification/retry เพิ่ม 10 รายการผ่านหลังปรับข้อความ
- ไม่มี schema migration ไม่มีการรีเซ็ตข้อมูลจริง ไม่ commit/push ใช้ Gmail env ที่ย้ายแล้วต่อไป ไม่พิมพ์ App Password และไม่ส่ง Gmail จริงระหว่างทดสอบ การนำขึ้นเว็บใช้เฉพาะ Docker web โดยไม่รัน setup/seed-admin
- Docker engine กลับมาแล้ว build รอบสุดท้ายผ่านและอัปเดตเฉพาะ web สำเร็จ /api/health ตอบ 200/ok; runtime โหลด gmail-app-password และ App Password แล้ว (ไม่แสดงค่ารหัส) ลบเฉพาะฐานข้อมูลทดสอบ examsystem_test_email_policy_20261006 ที่สร้างในรอบนี้ ฐานข้อมูลจริงและ volumes เดิมคงอยู่ ไม่ได้ยืนยันการส่งถึง Gmail จริงจากการตรวจ health
