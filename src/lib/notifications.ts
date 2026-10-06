import "server-only";

import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { examRequests, notifications, requestStatusHistory, subjects } from "@/db/schema";
import { INSTRUCTOR_STATUS_NOTIFICATIONS, type InstructorNotification } from "@/lib/notification-types";

export async function getInstructorNotifications(userId: string): Promise<InstructorNotification[]> {
  const reason = db.select({ reason: requestStatusHistory.reason }).from(requestStatusHistory)
    .where(and(eq(requestStatusHistory.requestId, notifications.requestId), eq(requestStatusHistory.toStatus, "ปฏิเสธ/ส่งกลับแก้ไข"), lte(requestStatusHistory.createdAt, notifications.createdAt)))
    .orderBy(desc(requestStatusHistory.createdAt), desc(requestStatusHistory.id)).limit(1);
  const records = await db.select({
    id: notifications.id, requestId: examRequests.id, requestNo: examRequests.requestNo,
    courseCode: subjects.courseCode, courseName: subjects.courseName,
    type: notifications.type, createdAt: notifications.createdAt,
    reason: sql<string | null>`case when ${notifications.type} = 'ส่งกลับแก้ไข' then (${reason}) else null end`,
  }).from(notifications).innerJoin(examRequests, eq(notifications.requestId, examRequests.id)).innerJoin(subjects, eq(examRequests.subjectId, subjects.id))
    .where(and(eq(notifications.userId, userId), eq(examRequests.instructorId, userId), inArray(notifications.type, Object.values(INSTRUCTOR_STATUS_NOTIFICATIONS))))
    .orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(50);
  return records.map(({ type, createdAt, ...record }) => ({ ...record, createdAt: createdAt.toISOString(), status: Object.entries(INSTRUCTOR_STATUS_NOTIFICATIONS).find(([, value]) => value === type)![0] as InstructorNotification["status"] }));
}
