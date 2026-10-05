import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import type { DraftSubmissionForm } from "@/lib/submission-form";

export const appSchema = pgSchema("app");

export const requestStatusEnum = appSchema.enum("request_status", [
  "ฉบับร่าง",
  "รอตรวจสอบ",
  "ปฏิเสธ/ส่งกลับแก้ไข",
  "ตัดข้อสอบ",
  "กำลังพิมพ์",
  "พิมพ์เสร็จแล้ว",
  "ส่งมอบแล้ว", // Historical rows only; active workflow ends at printed.
]);

export const printStatusEnum = appSchema.enum("print_status", [
  "รอพิมพ์",
  "กำลังพิมพ์",
  "พิมพ์เสร็จแล้ว",
]);

export const fileKindEnum = appSchema.enum("exam_file_kind", [
  "ต้นฉบับ",
  "พร้อมพิมพ์",
]);

export const notificationTypeEnum = appSchema.enum("notification_type", [
  "สร้างบัญชี",
  "คำขอใหม่",
  "ยกเลิกคำขอ",
  "รับคำขอ",
  "ส่งกลับแก้ไข",
  "เริ่มพิมพ์",
  "พิมพ์เสร็จ",
  "พร้อมส่งมอบ",
  "ส่งมอบ",
  "รีเซ็ตรหัสผ่าน",
]);

export const mailStatusEnum = appSchema.enum("mail_status", [
  "Pending",
  "Sent",
  "Failed",
]);

export const examRounds = appSchema.table(
  "exam_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    academicYear: text("academic_year").notNull(),
    semester: text("semester").notNull(),
    submissionStartsOn: date("submission_starts_on", { mode: "string" }),
    submissionEndsOn: date("submission_ends_on", { mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("exam_rounds_name_year_semester_uidx").on(
      table.name,
      table.academicYear,
      table.semester,
    ),
    index("exam_rounds_active_idx").on(table.isActive),
  ],
);

export const subjects = appSchema.table(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => examRounds.id, { onDelete: "cascade" }),
    courseCode: text("course_code").notNull(),
    courseName: text("course_name").notNull(),
    facultyName: text("faculty_name"),
    groupNo: text("group_no").notNull(),
    instructorId: text("instructor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("subjects_round_course_group_uidx").on(
      table.roundId,
      table.courseCode,
      table.groupNo,
    ),
    index("subjects_instructor_idx").on(table.instructorId),
  ],
);

export const rooms = appSchema.table(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    building: text("building"),
    capacity: integer("capacity").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [check("rooms_capacity_nonnegative", sql`${table.capacity} >= 0`)],
);

export const examRooms = appSchema.table(
  "exam_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    examDate: date("exam_date", { mode: "string" }).notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    studentCount: integer("student_count"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("exam_rooms_schedule_uidx").on(
      table.subjectId,
      table.roomId,
      table.examDate,
      table.startsAt,
    ),
    index("exam_rooms_room_schedule_idx").on(
      table.roomId,
      table.examDate,
      table.startsAt,
    ),
    check("exam_rooms_student_count_nonnegative", sql`${table.studentCount} >= 0`),
    check("exam_rooms_time_order", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const examRequests = appSchema.table(
  "exam_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestNo: text("request_no").notNull().unique(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    instructorId: text("instructor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    pageCount: integer("page_count").notNull(),
    originalCopyCount: integer("original_copy_count").notNull().default(1),
    submissionForm: jsonb("submission_form").$type<DraftSubmissionForm>(),
    printDetail: text("print_detail"),
    status: requestStatusEnum("status").notNull().default("ฉบับร่าง"),
    rejectReason: text("reject_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by").references(() => user.id, {
      onDelete: "set null",
    }),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exam_requests_subject_idx").on(table.subjectId),
    index("exam_requests_instructor_status_idx").on(
      table.instructorId,
      table.status,
    ),
    index("exam_requests_cancelled_idx").on(table.cancelledAt),
    uniqueIndex("exam_requests_active_subject_uidx")
      .on(table.subjectId)
      .where(sql`${table.cancelledAt} is null`),
    check("exam_requests_page_count_positive", sql`${table.pageCount} > 0`),
    check(
      "exam_requests_original_count_is_one",
      sql`${table.originalCopyCount} = 1`,
    ),
  ],
);

export const requestRooms = appSchema.table(
  "request_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => examRequests.id, { onDelete: "cascade" }),
    examRoomId: uuid("exam_room_id")
      .notNull()
      .references(() => examRooms.id, { onDelete: "restrict" }),
    roomCode: text("room_code").notNull(),
    roomName: text("room_name").notNull(),
    building: text("building"),
    examDate: date("exam_date", { mode: "string" }).notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    studentCount: integer("student_count").notNull(),
    reserveCount: integer("reserve_count").notNull().default(1),
    baseCopyCount: integer("base_copy_count").notNull().default(0),
    printCount: integer("print_count").notNull(),
    senderName: text("sender_name").notNull(),
    note: text("note"),
    qrToken: uuid("qr_token").notNull().defaultRandom().unique(), // Legacy column, no QR is generated.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("request_rooms_request_exam_room_uidx").on(
      table.requestId,
      table.examRoomId,
    ),
    index("request_rooms_qr_token_idx").on(table.qrToken),
    check("request_rooms_student_count_nonnegative", sql`${table.studentCount} >= 0`),
    check("request_rooms_reserve_count_nonnegative", sql`${table.reserveCount} >= 0`),
    check(
      "request_rooms_print_count_consistent",
      sql`${table.printCount} = ${table.baseCopyCount} + ${table.reserveCount}`,
    ),
    check("request_rooms_base_nonnegative", sql`${table.baseCopyCount} >= 0`),
  ],
);

export const examFiles = appSchema.table(
  "exam_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => examRequests.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    kind: fileKindEnum("kind").notNull().default("ต้นฉบับ"),
    originalFileName: text("original_file_name").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    contentType: text("content_type").notNull().default("application/pdf"),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    version: integer("version").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("exam_files_request_kind_version_uidx").on(
      table.requestId,
      table.kind,
      table.version,
    ),
    index("exam_files_request_idx").on(table.requestId),
    check("exam_files_size_positive", sql`${table.sizeBytes} > 0`),
    check(
      "exam_files_size_maximum",
      sql`${table.sizeBytes} <= 104857600`,
    ),
    check(
      "exam_files_pdf_content_type",
      sql`${table.contentType} = 'application/pdf'`,
    ),
    check(
      "exam_files_sha256_format",
      sql`${table.sha256} ~ '^[a-f0-9]{64}$'`,
    ),
    check("exam_files_version_positive", sql`${table.version} > 0`),
  ],
);

export const coverSheets = appSchema.table(
  "cover_sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestRoomId: uuid("request_room_id")
      .notNull()
      .references(() => requestRooms.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    sha256: text("sha256").notNull(),
    version: integer("version").notNull().default(1),
    generatedBy: text("generated_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    printRevision: integer("print_revision"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cover_sheets_room_version_uidx").on(
      table.requestRoomId,
      table.version,
    ),
    check(
      "cover_sheets_sha256_format",
      sql`${table.sha256} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export const printJobs = appSchema.table(
  "print_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => examRequests.id, { onDelete: "cascade" }),
    operatorId: text("operator_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: printStatusEnum("status").notNull().default("รอพิมพ์"),
    totalCopies: integer("total_copies").notNull(),
    selectedExamFileId: uuid("selected_exam_file_id").references(() => examFiles.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("print_jobs_request_uidx").on(table.requestId),
    index("print_jobs_operator_status_idx").on(table.operatorId, table.status),
    check("print_jobs_total_copies_nonnegative", sql`${table.totalCopies} >= 0`),
  ],
);

export const notifications = appSchema.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    requestId: uuid("request_id").references(() => examRequests.id, {
      onDelete: "cascade",
    }),
    type: notificationTypeEnum("type").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    emailTo: text("email_to").notNull(),
    deliveryStatus: mailStatusEnum("delivery_status")
      .notNull()
      .default("Pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_delivery_status_idx").on(table.deliveryStatus),
    index("notifications_request_idx").on(table.requestId),
    check("notifications_attempts_nonnegative", sql`${table.attempts} >= 0`),
  ],
);

export const requestStatusHistory = appSchema.table(
  "request_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => examRequests.id, { onDelete: "cascade" }),
    fromStatus: requestStatusEnum("from_status"),
    toStatus: requestStatusEnum("to_status").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorUsernameSnapshot: text("actor_username_snapshot").notNull(),
    actorRoleSnapshot: text("actor_role_snapshot").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("request_status_history_request_idx").on(table.requestId)],
);

export const auditLogs = appSchema.table(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorUsernameSnapshot: text("actor_username_snapshot").notNull(),
    actorRoleSnapshot: text("actor_role_snapshot").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
  ],
);

export const examRoundRelations = relations(examRounds, ({ many, one }) => ({
  creator: one(user, { fields: [examRounds.createdBy], references: [user.id] }),
  subjects: many(subjects),
}));

export const subjectRelations = relations(subjects, ({ many, one }) => ({
  round: one(examRounds, { fields: [subjects.roundId], references: [examRounds.id] }),
  instructor: one(user, { fields: [subjects.instructorId], references: [user.id] }),
  examRooms: many(examRooms),
  requests: many(examRequests),
}));

export const roomRelations = relations(rooms, ({ many }) => ({
  examRooms: many(examRooms),
}));

export const examRoomRelations = relations(examRooms, ({ many, one }) => ({
  subject: one(subjects, { fields: [examRooms.subjectId], references: [subjects.id] }),
  room: one(rooms, { fields: [examRooms.roomId], references: [rooms.id] }),
  requestRooms: many(requestRooms),
}));

export const examRequestRelations = relations(examRequests, ({ many, one }) => ({
  subject: one(subjects, { fields: [examRequests.subjectId], references: [subjects.id] }),
  instructor: one(user, {
    fields: [examRequests.instructorId],
    references: [user.id],
  }),
  rooms: many(requestRooms),
  files: many(examFiles),
  printJobs: many(printJobs),
  notifications: many(notifications),
  statusHistory: many(requestStatusHistory),
}));

export const requestRoomRelations = relations(requestRooms, ({ many, one }) => ({
  request: one(examRequests, {
    fields: [requestRooms.requestId],
    references: [examRequests.id],
  }),
  examRoom: one(examRooms, {
    fields: [requestRooms.examRoomId],
    references: [examRooms.id],
  }),
  coverSheets: many(coverSheets),
}));

export const examFileRelations = relations(examFiles, ({ one }) => ({
  request: one(examRequests, {
    fields: [examFiles.requestId],
    references: [examRequests.id],
  }),
  uploader: one(user, { fields: [examFiles.uploadedBy], references: [user.id] }),
}));

export const coverSheetRelations = relations(coverSheets, ({ one }) => ({
  requestRoom: one(requestRooms, {
    fields: [coverSheets.requestRoomId],
    references: [requestRooms.id],
  }),
  generator: one(user, {
    fields: [coverSheets.generatedBy],
    references: [user.id],
  }),
}));

export const printJobRelations = relations(printJobs, ({ one }) => ({
  request: one(examRequests, {
    fields: [printJobs.requestId],
    references: [examRequests.id],
  }),
  operator: one(user, { fields: [printJobs.operatorId], references: [user.id] }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  recipient: one(user, { fields: [notifications.userId], references: [user.id] }),
  request: one(examRequests, {
    fields: [notifications.requestId],
    references: [examRequests.id],
  }),
}));

export const requestStatusHistoryRelations = relations(
  requestStatusHistory,
  ({ one }) => ({
    request: one(examRequests, {
      fields: [requestStatusHistory.requestId],
      references: [examRequests.id],
    }),
    actor: one(user, {
      fields: [requestStatusHistory.actorId],
      references: [user.id],
    }),
  }),
);

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  actor: one(user, { fields: [auditLogs.actorId], references: [user.id] }),
}));
