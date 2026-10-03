ALTER TABLE "app"."request_rooms" DROP CONSTRAINT "request_rooms_print_count_consistent";--> statement-breakpoint
ALTER TABLE "app"."exam_rooms" ALTER COLUMN "student_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."cover_sheets" ADD COLUMN "print_revision" integer;--> statement-breakpoint
ALTER TABLE "app"."exam_requests" ADD COLUMN "submission_form" jsonb;--> statement-breakpoint
ALTER TABLE "app"."print_jobs" ADD COLUMN "selected_exam_file_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."print_jobs" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."print_jobs" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."request_rooms" ADD COLUMN "base_copy_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "app"."request_rooms" SET "base_copy_count" = "student_count";--> statement-breakpoint
ALTER TABLE "app"."print_jobs" ADD CONSTRAINT "print_jobs_selected_exam_file_id_exam_files_id_fk" FOREIGN KEY ("selected_exam_file_id") REFERENCES "app"."exam_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_rooms" ADD CONSTRAINT "request_rooms_base_nonnegative" CHECK ("app"."request_rooms"."base_copy_count" >= 0);--> statement-breakpoint
ALTER TABLE "app"."request_rooms" ADD CONSTRAINT "request_rooms_print_count_consistent" CHECK ("app"."request_rooms"."print_count" = "app"."request_rooms"."base_copy_count" + "app"."request_rooms"."reserve_count");
