ALTER TYPE "app"."notification_type" ADD VALUE 'คำขอใหม่' BEFORE 'รับคำขอ';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'ยกเลิกคำขอ' BEFORE 'รับคำขอ';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'พร้อมส่งมอบ' BEFORE 'ส่งมอบ';--> statement-breakpoint
DROP INDEX "app"."print_jobs_request_idx";--> statement-breakpoint
ALTER TABLE "app"."deliveries" ALTER COLUMN "receiver_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ALTER COLUMN "receiver_name_snapshot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ALTER COLUMN "delivered_at" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_uidx" ON "better_auth"."accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_requests_active_subject_uidx" ON "app"."exam_requests" USING btree ("subject_id") WHERE "app"."exam_requests"."cancelled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "print_jobs_request_uidx" ON "app"."print_jobs" USING btree ("request_id");--> statement-breakpoint
ALTER TABLE "better_auth"."users" ADD CONSTRAINT "users_role_allowed" CHECK ("better_auth"."users"."role" in ('ผู้ดูแลระบบ', 'เจ้าหน้าที่', 'อาจารย์', 'หน่วยโสต'));--> statement-breakpoint
ALTER TABLE "app"."cover_sheets" ADD CONSTRAINT "cover_sheets_sha256_format" CHECK ("app"."cover_sheets"."sha256" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "app"."exam_files" ADD CONSTRAINT "exam_files_size_maximum" CHECK ("app"."exam_files"."size_bytes" <= 104857600);--> statement-breakpoint
ALTER TABLE "app"."exam_files" ADD CONSTRAINT "exam_files_pdf_content_type" CHECK ("app"."exam_files"."content_type" = 'application/pdf');--> statement-breakpoint
ALTER TABLE "app"."exam_files" ADD CONSTRAINT "exam_files_sha256_format" CHECK ("app"."exam_files"."sha256" ~ '^[a-f0-9]{64}$');