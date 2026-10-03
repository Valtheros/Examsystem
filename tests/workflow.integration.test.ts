import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const state = vi.hoisted(() => ({ user: { id: "", username: "", name: "", role: "อาจารย์" } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("TEST_REDIRECT"); } }));
vi.mock("@/lib/session", () => ({ requireRole: async (allowed: string[]) => { if (!allowed.includes(state.user.role)) throw new Error("Forbidden"); return { user: { ...state.user } }; }, requireSession: async () => ({ user: { ...state.user } }) }));
vi.mock("@/lib/mail", () => ({ queueAndTrySendEmail: async () => undefined }));

import { db } from "@/db";
import { auditLogs, coverSheets, examFiles, examRequests, examRooms, examRounds, printJobs, requestRooms, requestStatusHistory, rooms, subjects, user } from "@/db/schema";
import { saveSubmissionAction } from "@/actions/submission";
import { savePrintPlanAction } from "@/actions/print-plan";
import { assignExamRoomAction } from "@/actions/setup";
import { cancelRequestAction } from "@/actions/requests";
import { transitionRequest } from "@/lib/workflow";
import { emptySubmissionForm } from "@/lib/submission-form";
import type { AppRole, RequestStatus } from "@/lib/constants";

const enabled = !!process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)("real PostgreSQL workflow (isolated database only)", () => {
  let teacher: typeof user.$inferSelect, officer: typeof user.$inferSelect, av: typeof user.$inferSelect;
  let subjectId: string, secondSubjectId: string, roomA: string, roomB: string;
  const form = { ...emptySubmissionForm, department: "วิทยาการคอมพิวเตอร์", language: "ไทย", printLayout: "หน้าเดียว", materials: ["ไม่มี"], computerAnswerSheet: "ไม่ต้องการ", scheduleType: "ในตาราง", coordinatorPhone: "0812345678" };
  function act(record: typeof user.$inferSelect) { state.user = { id: record.id, username: record.username!, name: record.name, role: record.role }; }
  function transition(requestId: string, toStatus: RequestStatus) { return transitionRequest({ requestId, toStatus, actor: { ...state.user, role: state.user.role as AppRole } }); }
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (url.hostname !== "localhost" || !url.pathname.startsWith("/examsystem_test_") || process.env.DATABASE_URL !== url.toString()) throw new Error("Refusing non-test database");
    [teacher] = await db.select().from(user).where(eq(user.username, "review.teacher"));
    [officer] = await db.select().from(user).where(eq(user.username, "review.officer"));
    [av] = await db.select().from(user).where(eq(user.username, "review.print"));
    const suffix = randomUUID().slice(0, 8);
    const [round] = await db.insert(examRounds).values({ name: `Integration ${suffix}`, academicYear: "2569", semester: "1", createdBy: officer.id }).returning();
    const allocated = await db.insert(subjects).values([1, 2].map((i) => ({ roundId: round.id, courseCode: `INT-${suffix}-${i}`, courseName: "Integration fixture", groupNo: "1", instructorId: teacher.id }))).returning();
    subjectId = allocated[0].id; secondSubjectId = allocated[1].id;
    const physical = await db.insert(rooms).values(["A", "B"].map((code) => ({ code: `${suffix}-${code}`, name: "Test room", capacity: 50 }))).returning();
    roomA = physical[0].id; roomB = physical[1].id;
  });
  it("serializes conflicting room reservations and permits separate rooms", async () => {
    act(officer);
    const schedule = (subjectId: string, roomId: string) => {
      const data = new FormData(); Object.entries({ subjectId, roomId, examDate: "2026-10-01", startsAt: "09:00", endsAt: "11:00" }).forEach(([key, value]) => data.set(key, value));
      return assignExamRoomAction({ ok: false, message: "" }, data);
    };
    const results = await Promise.all([schedule(subjectId, roomA), schedule(subjectId, roomA)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect((await schedule(subjectId, roomB)).ok).toBe(true);
    expect((await schedule(secondSubjectId, roomA)).ok).toBe(false);
  });
  it("keeps teacher counts, pins file versions, rejects stale covers and locks after start", async () => {
    act(teacher);
    const schedules = await db.select().from(examRooms).where(eq(examRooms.subjectId, subjectId));
    const input = { subjectId, pageCount: 1, submissionForm: form, roomCounts: schedules.map((row) => ({ examRoomId: row.id, count: 50 })) };
    expect((await saveSubmissionAction({ ...input, roomCounts: input.roomCounts.map((row) => ({ ...row, count: 51 })) })).ok).toBe(false);
    const saved = await saveSubmissionAction(input); expect(saved.ok).toBe(true); const id = saved.requestId!;
    await expect(transition(id, "รอตรวจสอบ")).rejects.toThrow("อัปโหลด");
    const files = await db.insert(examFiles).values([1, 2].map((version) => ({ requestId: id, uploadedBy: teacher.id, kind: "ต้นฉบับ" as const, originalFileName: `fixture-${version}.pdf`, storageKey: `integration/${randomUUID()}`, contentType: "application/pdf", sizeBytes: 100, sha256: "a".repeat(64), version }))).returning();
    await transition(id, "รอตรวจสอบ");
    act(officer);
    const data = new FormData(); Object.entries({ subjectId, roomId: roomA, examDate: "2026-10-02", startsAt: "09:00", endsAt: "11:00" }).forEach(([key, value]) => data.set(key, value));
    expect((await assignExamRoomAction({ ok: false, message: "" }, data)).ok).toBe(false);
    act(av); await transition(id, "ตัดข้อสอบ");
    const [job] = await db.select().from(printJobs).where(eq(printJobs.requestId, id)); expect(job.selectedExamFileId).toBe(files[1].id);
    await expect(transition(id, "กำลังพิมพ์")).rejects.toThrow("ยืนยันไฟล์");
    const allocations = await db.select().from(requestRooms).where(eq(requestRooms.requestId, id));
    const plan = { requestId: id, selectedExamFileId: files[1].id, revision: 1, reason: "เพิ่มเอกสารใช้งาน", rooms: allocations.map((row) => ({ id: row.id, baseCopyCount: 52, reserveCount: 2 })) };
    expect((await savePrintPlanAction({ ...plan, reason: "" })).ok).toBe(false);
    expect((await savePrintPlanAction(plan)).ok).toBe(true);
    for (const row of await db.select().from(requestRooms).where(eq(requestRooms.requestId, id))) { expect(row.studentCount).toBe(50); expect(row.printCount).toBe(54); }
    const cover = (revision: number) => db.insert(coverSheets).values(allocations.map((room) => ({ requestRoomId: room.id, storageKey: `integration-cover/${randomUUID()}`, sha256: "b".repeat(64), generatedBy: av.id, version: revision, printRevision: revision })));
    await cover(1); await expect(transition(id, "กำลังพิมพ์")).rejects.toThrow("รุ่นปัจจุบัน");
    await cover(2); await transition(id, "กำลังพิมพ์");
    expect((await savePrintPlanAction({ ...plan, revision: 2 })).ok).toBe(false);
    await transition(id, "พิมพ์เสร็จแล้ว");
    await expect(transition(id, "ส่งมอบแล้ว")).rejects.toThrow("ไม่สามารถเปลี่ยนสถานะ");
    expect((await db.select().from(examRequests).where(eq(examRequests.id, id)))[0].status).toBe("พิมพ์เสร็จแล้ว");
    const [finished] = await db.select().from(printJobs).where(eq(printJobs.requestId, id)); expect(finished.totalCopies).toBe(108);
    expect((await db.select().from(requestStatusHistory).where(eq(requestStatusHistory.requestId, id))).length).toBe(5);
    expect((await db.select().from(auditLogs).where(eq(auditLogs.targetId, id))).length).toBeGreaterThanOrEqual(6);
  });
  it("cancellation preserves every uploaded file version", async () => {
    act(teacher);
    const [request] = await db.insert(examRequests).values({ subjectId: secondSubjectId, requestNo: `CANCEL-${randomUUID()}`, instructorId: teacher.id, pageCount: 1 }).returning();
    await db.insert(examFiles).values([1, 2].map((version) => ({ requestId: request.id, uploadedBy: teacher.id, kind: "ต้นฉบับ" as const, originalFileName: `fixture-${version}.pdf`, storageKey: `integration/${randomUUID()}`, contentType: "application/pdf", sizeBytes: 100, sha256: "a".repeat(64), version })));
    const data = new FormData(); data.set("requestId", request.id);
    await expect(cancelRequestAction(data)).rejects.toThrow("TEST_REDIRECT");
    expect((await db.select().from(examFiles).where(eq(examFiles.requestId, request.id)))).toHaveLength(2);
    const [cancelled] = await db.select().from(examRequests).where(eq(examRequests.id, request.id)); expect(cancelled.cancelledAt).not.toBeNull();
  });
});
