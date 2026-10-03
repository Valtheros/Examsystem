# ERD ที่ใช้จริง

ฐานข้อมูลจริงคง 18 ตาราง (better_auth 4 / app 14) โดย deliveries และ distributions เก็บเฉพาะประวัติเดิม ไม่ใช้ใน workflow ใหม่ เหลือ 16 ตารางที่ใช้งานในระบบปัจจุบัน ภาพ erd-domain.png เป็นภาพอ้างอิงเดิม ความสัมพันธ์ที่ใช้งานแสดงด้านล่าง

```mermaid
erDiagram
  users ||--o{ sessions : HAS
  users ||--o{ accounts : HAS
  users ||--o{ exam_rounds : CREATES
  users ||--o{ subjects : TEACHES
  exam_rounds ||--o{ subjects : CONTAINS
  subjects ||--o{ exam_rooms : HAS
  rooms ||--o{ exam_rooms : USED_BY
  subjects ||--o{ exam_requests : HAS_REQUEST
  users ||--o{ exam_requests : SUBMITS
  exam_requests ||--o{ request_rooms : INCLUDES
  exam_rooms ||--o{ request_rooms : SNAPSHOTS
  exam_requests ||--o{ exam_files : HAS_FILE
  request_rooms ||--o{ cover_sheets : GENERATES
  exam_requests ||--o{ print_jobs : PRINTED_AS
  exam_files |o--o{ print_jobs : SELECTED_FOR
  exam_requests ||--o{ notifications : TRIGGERS
  users ||--o{ notifications : RECEIVES
  exam_requests ||--o{ request_status_history : HAS_STATUS
  users ||--o{ request_status_history : CHANGES
  users ||--o{ audit_logs : LOGS
```

`verifications` ไม่มี Foreign Key โดยตั้งใจ เพราะ Better Auth ใช้ identifier/value สำหรับ token อายุสั้น ตารางกลางที่แก้ความสัมพันธ์ many-to-many คือ `exam_rooms` (Subject–Room) และ snapshot ที่รับข้อมูลต่อห้องของคำขอคือ `request_rooms`

ฉบับ 3 ตุลาคม 2569: จบที่พิมพ์เสร็จแล้ว ไม่มี QR/รับมอบ/แจกจ่าย เก็บ FK เดิมของ deliveries → exam_requests และ distributions → deliveries/request_rooms ไว้เพื่อรักษาประวัติ ไม่ต้อง migration หรือลบตาราง

ฉบับ 13 กันยายน 2569: เพิ่ม `exam_requests.submission_form`, `request_rooms.base_copy_count`, `print_jobs.selected_exam_file_id/revision/confirmed_at`, `cover_sheets.print_revision` ไม่มีตารางใหม่ `exam_rooms.student_count` เป็นข้อมูลเดิม nullable เท่านั้น ยอดอาจารย์เก็บใน request_rooms.student_count และยอดพิมพ์ = base_copy_count + reserve_count ภาพ erd-domain.png เป็นภาพอ้างอิงเดิม ให้ใช้ physical relationship และ Data Dictionary ฉบับนี้สำหรับ implementation
