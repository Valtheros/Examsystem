CREATE SCHEMA "better_auth";
--> statement-breakpoint
CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."exam_file_kind" AS ENUM('ต้นฉบับ', 'พร้อมพิมพ์');--> statement-breakpoint
CREATE TYPE "app"."mail_status" AS ENUM('Pending', 'Sent', 'Failed');--> statement-breakpoint
CREATE TYPE "app"."notification_type" AS ENUM('สร้างบัญชี', 'รับคำขอ', 'ส่งกลับแก้ไข', 'เริ่มพิมพ์', 'พิมพ์เสร็จ', 'ส่งมอบ', 'รีเซ็ตรหัสผ่าน');--> statement-breakpoint
CREATE TYPE "app"."print_status" AS ENUM('รอพิมพ์', 'กำลังพิมพ์', 'พิมพ์เสร็จแล้ว');--> statement-breakpoint
CREATE TYPE "app"."request_status" AS ENUM('ฉบับร่าง', 'รอตรวจสอบ', 'ปฏิเสธ/ส่งกลับแก้ไข', 'ตัดข้อสอบ', 'กำลังพิมพ์', 'พิมพ์เสร็จแล้ว', 'ส่งมอบแล้ว');--> statement-breakpoint
CREATE TABLE "better_auth"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "better_auth"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text NOT NULL,
	"display_username" text,
	"role" text DEFAULT 'อาจารย์' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_by" text,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "better_auth"."verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_username_snapshot" text NOT NULL,
	"actor_role_snapshot" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."cover_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_room_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cover_sheets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "app"."deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text,
	"receiver_name_snapshot" text,
	"signature_storage_key" text,
	"delivered_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "app"."distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"request_room_id" uuid NOT NULL,
	"distributed_by" text NOT NULL,
	"distributed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "distributions_request_room_id_unique" UNIQUE("request_room_id")
);
--> statement-breakpoint
CREATE TABLE "app"."exam_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"kind" "app"."exam_file_kind" DEFAULT 'ต้นฉบับ' NOT NULL,
	"original_file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text DEFAULT 'application/pdf' NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"version" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_files_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "exam_files_size_positive" CHECK ("app"."exam_files"."size_bytes" > 0),
	CONSTRAINT "exam_files_version_positive" CHECK ("app"."exam_files"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."exam_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_no" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"instructor_id" text NOT NULL,
	"page_count" integer NOT NULL,
	"original_copy_count" integer DEFAULT 1 NOT NULL,
	"print_detail" text,
	"status" "app"."request_status" DEFAULT 'ฉบับร่าง' NOT NULL,
	"reject_reason" text,
	"submitted_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_requests_request_no_unique" UNIQUE("request_no"),
	CONSTRAINT "exam_requests_page_count_positive" CHECK ("app"."exam_requests"."page_count" > 0),
	CONSTRAINT "exam_requests_original_count_positive" CHECK ("app"."exam_requests"."original_copy_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."exam_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"exam_date" date NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"student_count" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_rooms_student_count_nonnegative" CHECK ("app"."exam_rooms"."student_count" >= 0),
	CONSTRAINT "exam_rooms_time_order" CHECK ("app"."exam_rooms"."ends_at" > "app"."exam_rooms"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "app"."exam_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"academic_year" text NOT NULL,
	"semester" text NOT NULL,
	"submission_starts_on" date,
	"submission_ends_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"request_id" uuid,
	"type" "app"."notification_type" NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"email_to" text NOT NULL,
	"delivery_status" "app"."mail_status" DEFAULT 'Pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_attempts_nonnegative" CHECK ("app"."notifications"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"operator_id" text NOT NULL,
	"status" "app"."print_status" DEFAULT 'รอพิมพ์' NOT NULL,
	"total_copies" integer NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_jobs_total_copies_nonnegative" CHECK ("app"."print_jobs"."total_copies" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."request_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"exam_room_id" uuid NOT NULL,
	"room_code" text NOT NULL,
	"room_name" text NOT NULL,
	"building" text,
	"exam_date" date NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"student_count" integer NOT NULL,
	"reserve_count" integer DEFAULT 1 NOT NULL,
	"print_count" integer NOT NULL,
	"sender_name" text NOT NULL,
	"note" text,
	"qr_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_rooms_qr_token_unique" UNIQUE("qr_token"),
	CONSTRAINT "request_rooms_student_count_nonnegative" CHECK ("app"."request_rooms"."student_count" >= 0),
	CONSTRAINT "request_rooms_reserve_count_nonnegative" CHECK ("app"."request_rooms"."reserve_count" >= 0),
	CONSTRAINT "request_rooms_print_count_consistent" CHECK ("app"."request_rooms"."print_count" = "app"."request_rooms"."student_count" + "app"."request_rooms"."reserve_count")
);
--> statement-breakpoint
CREATE TABLE "app"."request_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_status" "app"."request_status",
	"to_status" "app"."request_status" NOT NULL,
	"actor_id" text,
	"actor_username_snapshot" text NOT NULL,
	"actor_role_snapshot" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"building" text,
	"capacity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_code_unique" UNIQUE("code"),
	CONSTRAINT "rooms_capacity_nonnegative" CHECK ("app"."rooms"."capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"course_code" text NOT NULL,
	"course_name" text NOT NULL,
	"group_no" text NOT NULL,
	"instructor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "better_auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "better_auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "better_auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "better_auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "better_auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."cover_sheets" ADD CONSTRAINT "cover_sheets_request_room_id_request_rooms_id_fk" FOREIGN KEY ("request_room_id") REFERENCES "app"."request_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."cover_sheets" ADD CONSTRAINT "cover_sheets_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_request_id_exam_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."exam_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."distributions" ADD CONSTRAINT "distributions_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "app"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."distributions" ADD CONSTRAINT "distributions_request_room_id_request_rooms_id_fk" FOREIGN KEY ("request_room_id") REFERENCES "app"."request_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."distributions" ADD CONSTRAINT "distributions_distributed_by_users_id_fk" FOREIGN KEY ("distributed_by") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_files" ADD CONSTRAINT "exam_files_request_id_exam_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."exam_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_files" ADD CONSTRAINT "exam_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_requests" ADD CONSTRAINT "exam_requests_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "app"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_requests" ADD CONSTRAINT "exam_requests_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_requests" ADD CONSTRAINT "exam_requests_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "better_auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_rooms" ADD CONSTRAINT "exam_rooms_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "app"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_rooms" ADD CONSTRAINT "exam_rooms_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "app"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_rounds" ADD CONSTRAINT "exam_rounds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "better_auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_request_id_exam_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."exam_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_jobs" ADD CONSTRAINT "print_jobs_request_id_exam_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."exam_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."print_jobs" ADD CONSTRAINT "print_jobs_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_rooms" ADD CONSTRAINT "request_rooms_request_id_exam_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."exam_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_rooms" ADD CONSTRAINT "request_rooms_exam_room_id_exam_rooms_id_fk" FOREIGN KEY ("exam_room_id") REFERENCES "app"."exam_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_status_history" ADD CONSTRAINT "request_status_history_request_id_exam_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."exam_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_status_history" ADD CONSTRAINT "request_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "better_auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subjects" ADD CONSTRAINT "subjects_round_id_exam_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."exam_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subjects" ADD CONSTRAINT "subjects_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "better_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "better_auth"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "better_auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "better_auth"."users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_created_by_idx" ON "better_auth"."users" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "better_auth"."verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "app"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "app"."audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "app"."audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cover_sheets_room_version_uidx" ON "app"."cover_sheets" USING btree ("request_room_id","version");--> statement-breakpoint
CREATE INDEX "deliveries_receiver_idx" ON "app"."deliveries" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "distributions_delivery_idx" ON "app"."distributions" USING btree ("delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_files_request_kind_version_uidx" ON "app"."exam_files" USING btree ("request_id","kind","version");--> statement-breakpoint
CREATE INDEX "exam_files_request_idx" ON "app"."exam_files" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "exam_requests_subject_idx" ON "app"."exam_requests" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "exam_requests_instructor_status_idx" ON "app"."exam_requests" USING btree ("instructor_id","status");--> statement-breakpoint
CREATE INDEX "exam_requests_cancelled_idx" ON "app"."exam_requests" USING btree ("cancelled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_rooms_schedule_uidx" ON "app"."exam_rooms" USING btree ("subject_id","room_id","exam_date","starts_at");--> statement-breakpoint
CREATE INDEX "exam_rooms_room_schedule_idx" ON "app"."exam_rooms" USING btree ("room_id","exam_date","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_rounds_name_year_semester_uidx" ON "app"."exam_rounds" USING btree ("name","academic_year","semester");--> statement-breakpoint
CREATE INDEX "exam_rounds_active_idx" ON "app"."exam_rounds" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "notifications_delivery_status_idx" ON "app"."notifications" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "notifications_request_idx" ON "app"."notifications" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "print_jobs_request_idx" ON "app"."print_jobs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "print_jobs_operator_status_idx" ON "app"."print_jobs" USING btree ("operator_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "request_rooms_request_exam_room_uidx" ON "app"."request_rooms" USING btree ("request_id","exam_room_id");--> statement-breakpoint
CREATE INDEX "request_rooms_qr_token_idx" ON "app"."request_rooms" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX "request_status_history_request_idx" ON "app"."request_status_history" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_round_course_group_uidx" ON "app"."subjects" USING btree ("round_id","course_code","group_no");--> statement-breakpoint
CREATE INDEX "subjects_instructor_idx" ON "app"."subjects" USING btree ("instructor_id");