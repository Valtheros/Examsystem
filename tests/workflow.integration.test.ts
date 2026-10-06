import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { AuthorizationError } from "@/lib/errors";

const state = vi.hoisted(() => ({ user: { id: "", username: "", name: "", role: "อาจารย์" } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("TEST_REDIRECT"); } }));
vi.mock("@/lib/session", () => ({ requireRole: async (allowed: string[]) => { if (!allowed.includes(state.user.role)) throw new AuthorizationError(); return { user: { ...state.user } }; }, requireSession: async () => ({ user: { ...state.user } }) }));
vi.mock("@/lib/mail", () => ({ queueAndTrySendEmail: async () => undefined }));
vi.mock("@/lib/auth", () => ({ auth: { api: { verifyPassword: vi.fn(async ({ body }: { body: { password: string } }) => {
  if (body.password !== "isolated-test-password") throw new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD" });
  return { status: true };
}) } } }));
// No reset integration test may contact the production file bucket.
vi.mock("@/lib/storage", () => ({ purgeAllPrivateObjects: vi.fn(async () => 2), putPrivateObject: vi.fn(async () => undefined), deletePrivateObject: vi.fn(async () => undefined) }));

import { db } from "@/db";
import { account, auditLogs, coverSheets, examFiles, examRequests, examRooms, examRounds, notifications, printJobs, requestRooms, requestStatusHistory, rooms, session, subjects, user, verification } from "@/db/schema";
import { POST as resetSystem } from "@/app/api/admin/system-reset/route";
import { POST as generateCover } from "@/app/api/cover-sheets/generate/[requestRoomId]/route";
import { purgeAllPrivateObjects, putPrivateObject, deletePrivateObject } from "@/lib/storage";
import * as coverPdf from "@/lib/cover-pdf";
import { updateUserAction } from "@/actions/admin";
import { saveSubmissionAction } from "@/actions/submission";
import { savePrintPlanAction } from "@/actions/print-plan";
import { assignExamRoomAction, createExamRoundAction, createRoomAction, createSubjectAction, deleteSetupAction } from "@/actions/setup";
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
  it("edits and deletes unused setup records, but protects referenced requests and snapshots", async () => {
    const data = (values: Record<string, string>) => { const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, value)); return form; };
    const initial = { ok: false, message: "" };
    const remove = (kind: string, id: string) => deleteSetupAction(initial, data({ kind, id }));
    act(teacher);
    expect((await remove("room", roomA)).ok).toBe(false);
    act(officer);
    const code = `CRUD-${randomUUID().slice(0, 8)}`;
    expect((await createRoomAction(initial, data({ code, name: "ห้องเดิม", capacity: "40" }))).ok).toBe(true);
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    expect((await createRoomAction(initial, data({ editRoomId: room.id, code, name: "ห้องแก้ไข", capacity: "50" }))).ok).toBe(true);
    const [base] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
    const subjectInput = { roundId: base.roundId, instructorId: teacher.id, courseCode: code, courseName: "รายวิชาทดสอบ", facultyName: "คณะวิศวกรรมศาสตร์", groupNo: "1" };
    expect((await createSubjectAction(initial, data(subjectInput))).ok).toBe(true);
    const [subject] = await db.select().from(subjects).where(eq(subjects.courseCode, code));
    expect((await createSubjectAction(initial, data({ ...subjectInput, editSubjectId: subject.id, courseName: "แก้ไขรายวิชา" }))).ok).toBe(true);
    const scheduleInput = { subjectId: subject.id, roomId: room.id, examDate: "2026-10-02", startsAt: "09:00", endsAt: "10:00" };
    expect((await assignExamRoomAction(initial, data(scheduleInput))).ok).toBe(true);
    let [schedule] = await db.select().from(examRooms).where(eq(examRooms.subjectId, subject.id));
    expect((await assignExamRoomAction(initial, data({ ...scheduleInput, examRoomId: schedule.id, startsAt: "10:00", endsAt: "11:00" }))).ok).toBe(true);
    expect((await remove("room", room.id)).message).toContain("ตารางสอบ");
    expect((await remove("schedule", schedule.id)).ok).toBe(true);
    expect((await assignExamRoomAction(initial, data(scheduleInput))).ok).toBe(true);
    [schedule] = await db.select().from(examRooms).where(eq(examRooms.subjectId, subject.id));
    act(teacher);
    const saved = await saveSubmissionAction({ subjectId: subject.id, pageCount: 1, submissionForm: form, roomCounts: [{ examRoomId: schedule.id, count: 20 }] });
    expect(saved.ok).toBe(true);
    act(officer);
    expect((await createRoomAction(initial, data({ editRoomId: room.id, code, name: "ห้องแก้ไข", capacity: "19" }))).ok).toBe(false);
    expect((await createRoomAction(initial, data({ editRoomId: room.id, code, name: "ชื่อห้องใหม่", capacity: "50" }))).ok).toBe(true);
    expect((await db.select().from(requestRooms).where(eq(requestRooms.requestId, saved.requestId!)))[0].roomName).toBe("ห้องแก้ไข");
    expect((await remove("subject", subject.id)).ok).toBe(false);
    expect((await remove("schedule", schedule.id)).ok).toBe(false);
    await db.update(examRequests).set({ cancelledAt: new Date() }).where(eq(examRequests.id, saved.requestId!));
    expect((await remove("subject", subject.id)).message).toContain("ประวัติคำขอ");
    expect((await remove("schedule", schedule.id)).message).toContain("ประวัติคำขอ");
    expect((await db.select().from(auditLogs).where(eq(auditLogs.targetId, room.id))).map(row => row.action)).toContain("ROOM_UPDATED");
    const fresh = { ...subjectInput, courseCode: `${code}-FREE` };
    expect((await createSubjectAction(initial, data(fresh))).ok).toBe(true);
    const [unused] = await db.select().from(subjects).where(eq(subjects.courseCode, fresh.courseCode));
    const [freeRoom] = await db.insert(rooms).values({ code: `${code}-FREE`, name: "Unused room", capacity: 40 }).returning();
    expect((await assignExamRoomAction(initial, data({ ...scheduleInput, subjectId: unused.id, roomId: freeRoom.id }))).ok).toBe(true);
    expect((await remove("subject", unused.id)).ok).toBe(true);
    expect(await db.select().from(examRooms).where(eq(examRooms.subjectId, unused.id))).toHaveLength(0);
    expect((await remove("room", freeRoom.id)).ok).toBe(true);
  });
  it("edits/deletes unused rounds atomically and protects all request history", async () => {
    const data = (values: Record<string, string>) => { const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, value)); return form; };
    const initial = { ok: false, message: "" };
    const input = { name: `Round CRUD ${randomUUID().slice(0, 8)}`, academicYear: "2569", semester: "1", submissionStartsOn: "2026-10-01", submissionEndsOn: "2026-10-15" };
    act(teacher);
    expect((await createExamRoundAction(initial, data(input))).ok).toBe(false);
    act(officer);
    expect((await createExamRoundAction(initial, data(input))).ok).toBe(true);
    expect((await createExamRoundAction(initial, data(input))).message).toContain("มีรอบสอบ");
    const [round] = await db.select().from(examRounds).where(eq(examRounds.name, input.name));
    expect((await createExamRoundAction(initial, data({ ...input, editRoundId: round.id, semester: "2" }))).ok).toBe(true);
    expect((await db.select().from(examRounds).where(eq(examRounds.id, round.id)))[0].semester).toBe("2");
    const [unused] = await db.insert(subjects).values({ roundId: round.id, courseCode: randomUUID().slice(0, 8), courseName: "Unused", groupNo: "1", instructorId: teacher.id }).returning();
    const [schedule] = await db.insert(examRooms).values({ subjectId: unused.id, roomId: roomA, examDate: "2026-10-10", startsAt: "09:00", endsAt: "10:00" }).returning();
    expect((await deleteSetupAction(initial, data({ kind: "round", id: round.id }))).ok).toBe(true);
    expect(await db.select().from(subjects).where(eq(subjects.id, unused.id))).toHaveLength(0);
    expect(await db.select().from(examRooms).where(eq(examRooms.id, schedule.id))).toHaveLength(0);
    expect((await db.select().from(auditLogs).where(eq(auditLogs.targetId, round.id))).map(row => row.action).sort()).toEqual(["EXAM_ROUND_CREATED", "EXAM_ROUND_UPDATED", "EXAM_ROUND_DELETED"].sort());
    const [historic] = await db.select().from(subjects).where(eq(subjects.id, secondSubjectId));
    expect((await createExamRoundAction(initial, data({ ...input, editRoundId: historic.roundId }))).message).toContain("ประวัติคำขอ");
    expect((await deleteSetupAction(initial, data({ kind: "round", id: historic.roundId }))).message).toContain("ประวัติคำขอ");
    expect(await db.select().from(examRequests).where(eq(examRequests.subjectId, secondSubjectId))).toHaveLength(1);
  });
  it("serializes round deletion with an instructor creating a request", async () => {
    const [round] = await db.insert(examRounds).values({ name: `Race ${randomUUID()}`, academicYear: "2569", semester: "1", createdBy: officer.id }).returning();
    const [subject] = await db.insert(subjects).values({ roundId: round.id, courseCode: "RACE", courseName: "Race", groupNo: "1", instructorId: teacher.id }).returning();
    const [schedule] = await db.insert(examRooms).values({ subjectId: subject.id, roomId: roomB, examDate: "2026-10-11", startsAt: "09:00", endsAt: "10:00" }).returning();
    act(teacher);
    const request = saveSubmissionAction({ subjectId: subject.id, pageCount: 1, submissionForm: form, roomCounts: [{ examRoomId: schedule.id, count: 20 }] });
    act(officer);
    const data = new FormData(); data.set("kind", "round"); data.set("id", round.id);
    const results = await Promise.all([request, deleteSetupAction({ ok: false, message: "" }, data)]);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect((await db.select().from(examRounds).where(eq(examRounds.id, round.id))).length).toBe(results[0].ok ? 1 : 0);
  });
  it("uses the latest instructor name in new covers, keeps old covers, and rejects a concurrent name change", async () => {
    const [base] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
    const [subject] = await db.insert(subjects).values({ roundId: base.roundId, courseCode: `COVER-${randomUUID().slice(0, 8)}`, courseName: "Cover name regression", groupNo: "1", instructorId: teacher.id }).returning();
    const [schedule] = await db.insert(examRooms).values({ subjectId: subject.id, roomId: roomA, examDate: "2026-11-01", startsAt: "09:00", endsAt: "10:00" }).returning();
    act(teacher);
    const saved = await saveSubmissionAction({ subjectId: subject.id, pageCount: 1, submissionForm: form, roomCounts: [{ examRoomId: schedule.id, count: 20 }] });
    expect(saved.ok).toBe(true);
    const id = saved.requestId!;
    const [file] = await db.insert(examFiles).values({ requestId: id, uploadedBy: teacher.id, kind: "ต้นฉบับ", originalFileName: "cover-name.pdf", storageKey: `integration/${randomUUID()}`, contentType: "application/pdf", sizeBytes: 100, sha256: "a".repeat(64), version: 1 }).returning();
    await transition(id, "รอตรวจสอบ"); act(av); await transition(id, "ตัดข้อสอบ");
    const [job] = await db.select().from(printJobs).where(eq(printJobs.requestId, id));
    const [room] = await db.select().from(requestRooms).where(eq(requestRooms.requestId, id));
    expect((await savePrintPlanAction({ requestId: id, selectedExamFileId: file.id, revision: job.revision, reason: "", rooms: [{ id: room.id, baseCopyCount: 20, reserveCount: 1 }] })).ok).toBe(true);
    const generate = () => generateCover(new Request("http://localhost/api/cover-sheets/generate", { method: "POST" }), { params: Promise.resolve({ requestRoomId: room.id }) });
    const render = vi.spyOn(coverPdf, "createCoverPdf");
    try {
      expect((await generate()).status).toBe(201);
      const [old] = await db.select().from(coverSheets).where(eq(coverSheets.requestRoomId, room.id));
      const [admin] = await db.select().from(user).where(eq(user.username, "review.admin"));
      act(admin);
      const change = new FormData(); Object.entries({ userId: teacher.id, name: "อาจารย์ชื่อใหม่", email: teacher.email, role: teacher.role }).forEach(([key, value]) => change.set(key, value));
      expect((await updateUserAction({ ok: false, message: "" }, change)).ok).toBe(true);
      act(av);
      expect((await generate()).status).toBe(201);
      expect(render.mock.lastCall?.[0].senderName).toBe("อาจารย์ชื่อใหม่");
      expect((await db.select().from(coverSheets).where(eq(coverSheets.id, old.id)))[0]).toEqual(old);
      expect((await db.select().from(coverSheets).where(eq(coverSheets.requestRoomId, room.id)))).toHaveLength(2);
      expect((await db.select().from(requestRooms).where(eq(requestRooms.id, room.id)))[0].senderName).toBe(room.senderName);
      vi.mocked(putPrivateObject).mockImplementationOnce(async () => { await db.update(user).set({ name: "เปลี่ยนชื่อระหว่างสร้าง" }).where(eq(user.id, teacher.id)); });
      const conflict = await generate();
      expect(conflict.status).toBe(409);
      expect((await conflict.json()).message).toContain("ชื่ออาจารย์เปลี่ยน");
      expect(deletePrivateObject).toHaveBeenCalledTimes(1);
      expect((await db.select().from(coverSheets).where(eq(coverSheets.requestRoomId, room.id)))).toHaveLength(2);
    } finally { render.mockRestore(); await db.update(user).set({ name: teacher.name }).where(eq(user.id, teacher.id)); }
  }, 20000);
  it("clears exam data only, preserves all auth/history, and safely handles locks and storage retry", async () => {
    const [admin] = await db.select().from(user).where(eq(user.username, "review.admin"));
    const reset = (options = {}) => resetSystem(new Request("http://localhost:3000/api/admin/system-reset", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "exam-data", confirmation: "CLEAR EXAM DATA", currentPassword: "isolated-test-password", ...options }),
    }));
    const business = [examRounds, subjects, rooms, examRooms, examRequests, requestRooms, examFiles, coverSheets, printJobs, notifications, requestStatusHistory];
    const totals = () => Promise.all(business.map(async table => (await db.select({ value: count() }).from(table))[0].value));
    for (const role of [teacher, officer, av]) { act(role); expect((await reset()).status).toBe(403); }
    act(admin);
    expect((await reset({ confirmation: "RESET EXAM SYSTEM" })).status).toBe(422);
    const invalid = await reset({ currentPassword: "wrong-password" });
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).message).toBe("รหัสผ่านปัจจุบันไม่ถูกต้อง");
    expect(purgeAllPrivateObjects).not.toHaveBeenCalled();
    const [request] = await db.select().from(examRequests).limit(1);
    await db.insert(notifications).values({ userId: teacher.id, requestId: request.id, type: "คำขอใหม่", subject: "Test", message: "Test", emailTo: "test@example.local" });
    await db.insert(session).values({ id: randomUUID(), userId: teacher.id, token: randomUUID(), expiresAt: new Date(Date.now() + 3600000) });
    await db.insert(verification).values({ id: randomUUID(), identifier: randomUUID(), value: "test-only-token", expiresAt: new Date(Date.now() + 3600000) });
    const authRecords = () => Promise.all([db.select().from(user).orderBy(user.id), db.select().from(account).orderBy(account.id), db.select().from(session).orderBy(session.id), db.select().from(verification).orderBy(verification.id)]);
    const accountsBefore = await authRecords();
    const logsBefore = await db.select({ id: auditLogs.id }).from(auditLogs);
    expect((await totals()).every(value => value > 0)).toBe(true);
    const lock = await db.$client.reserve();
    try {
      await lock`select pg_advisory_lock(921001)`;
      expect((await reset()).status).toBe(409);
    } finally { await lock`select pg_advisory_unlock(921001)`; lock.release(); }
    expect(await totals()).not.toEqual(business.map(() => 0));
    expect(await authRecords()).toEqual(accountsBefore);

    let release!: (value: number) => void;
    let reached!: () => void;
    const storageStarted = new Promise<void>(done => { reached = done; });
    vi.mocked(purgeAllPrivateObjects).mockImplementationOnce(() => { reached(); return new Promise(done => { release = done; }); });
    const clearing = reset();
    await storageStarted;
    // The database has committed, but mutations must stay blocked until file cleanup ends.
    const [blocked] = await db.execute(sql`select pg_try_advisory_xact_lock_shared(921001) as acquired`);
    expect(blocked.acquired).toBe(false);
    expect((await reset()).status).toBe(409);
    release(2);
    const result = await clearing;
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ ok: true, deletedFiles: 2 });
    expect(await totals()).toEqual(business.map(() => 0));
    expect(await authRecords()).toEqual(accountsBefore);
    const logsAfter = await db.select().from(auditLogs);
    expect(logsBefore.every(row => logsAfter.some(log => log.id === row.id))).toBe(true);
    expect(logsAfter.map(row => row.action)).toContain("EXAM_DATA_CLEAR_COMPLETED");

    vi.mocked(purgeAllPrivateObjects).mockRejectedValueOnce(new Error("Test storage unavailable"));
    expect((await reset()).status).toBe(207);
    expect(await totals()).toEqual(business.map(() => 0));
    expect(await authRecords()).toEqual(accountsBefore);
    const retry = await reset({ storageOnly: true });
    expect(retry.status).toBe(200);
    expect((await db.select().from(auditLogs)).map(row => row.action)).toContain("EXAM_DATA_CLEAR_STORAGE_RETRY_COMPLETED");
    const [round] = await db.insert(examRounds).values({ name: "New work", academicYear: "2569", semester: "1", createdBy: officer.id }).returning();
    const [subject] = await db.insert(subjects).values({ roundId: round.id, courseCode: "NEW", courseName: "New work", groupNo: "1", instructorId: teacher.id }).returning();
    const [newRequest] = await db.insert(examRequests).values({ subjectId: subject.id, requestNo: randomUUID(), instructorId: teacher.id, pageCount: 1 }).returning();
    const calls = vi.mocked(purgeAllPrivateObjects).mock.calls.length;
    expect((await reset({ storageOnly: true })).status).toBe(409);
    expect(purgeAllPrivateObjects).toHaveBeenCalledTimes(calls);
    expect(await db.select().from(examRequests).where(eq(examRequests.id, newRequest.id))).toHaveLength(1);
    expect(await authRecords()).toEqual(accountsBefore);
  });
});
