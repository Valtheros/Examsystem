import "server-only";

import { and, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { examRequests, examRounds, subjects, user } from "@/db/schema";
import type { RequestListItem } from "@/components/request-list";
import type { RequestStatus } from "@/lib/constants";

export async function listRequests(filters: {
  instructorId?: string;
  statuses?: RequestStatus[];
  query?: string;
}) {
  const conditions: SQL[] = [isNull(examRequests.cancelledAt)];
  if (filters.instructorId) conditions.push(eq(examRequests.instructorId, filters.instructorId));
  if (filters.statuses?.length) conditions.push(inArray(examRequests.status, filters.statuses));
  if (filters.query?.trim()) {
    const term = `%${filters.query.trim().replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(examRequests.requestNo, term), ilike(subjects.courseCode, term), ilike(subjects.courseName, term), ilike(user.name, term), ilike(examRounds.name, term))!);
  }
  const rows = await db
    .select({
      id: examRequests.id,
      requestNo: examRequests.requestNo,
      courseCode: subjects.courseCode,
      courseName: subjects.courseName,
      groupNo: subjects.groupNo,
      instructorName: user.name,
      roundName: examRounds.name,
      status: examRequests.status,
      updatedAt: examRequests.updatedAt,
    })
    .from(examRequests)
    .innerJoin(subjects, eq(examRequests.subjectId, subjects.id))
    .innerJoin(examRounds, eq(subjects.roundId, examRounds.id))
    .innerJoin(user, eq(examRequests.instructorId, user.id))
    .where(and(...conditions))
    .orderBy(desc(examRequests.updatedAt));
  return rows satisfies RequestListItem[];
}
