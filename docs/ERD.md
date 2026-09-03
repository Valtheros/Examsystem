# ERD ที่ใช้จริง

ฐานข้อมูลมี 18 ตาราง แบ่งเป็น schema `better_auth` 4 ตารางและ `app` 14 ตาราง ภาพ `erd-domain.png` เป็น ERD กระบวนการธุรกิจแบบที่อนุมัติก่อนหน้า ส่วน physical relationship ฉบับที่ตรงกับ migration แสดงด้านล่าง

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
  exam_requests ||--o| deliveries : DELIVERED_AS
  deliveries ||--o{ distributions : DISTRIBUTES
  request_rooms ||--o| distributions : FOR_ROOM
  exam_requests ||--o{ notifications : TRIGGERS
  users ||--o{ notifications : RECEIVES
  exam_requests ||--o{ request_status_history : HAS_STATUS
  users ||--o{ request_status_history : CHANGES
  users ||--o{ audit_logs : LOGS
```

`verifications` ไม่มี Foreign Key โดยตั้งใจ เพราะ Better Auth ใช้ identifier/value สำหรับ token อายุสั้น ตารางกลางที่แก้ความสัมพันธ์ many-to-many คือ `exam_rooms` (Subject–Room) และ snapshot ที่รับข้อมูลต่อห้องของคำขอคือ `request_rooms`
