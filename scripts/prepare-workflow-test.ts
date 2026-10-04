// Creates fixtures only in a NEW, explicitly named local test database. Never resets data.
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const url = new URL(process.env.TEST_DATABASE_URL || "http://invalid");
if (url.hostname !== "localhost" || !url.pathname.startsWith("/examsystem_test_")) throw new Error("Explicit local examsystem_test_ database required");
const sql = postgres(url.toString(), { max: 1, prepare: false });
try {
  const [existing] = await sql`select count(*)::int as count from information_schema.tables where table_schema in ('app','better_auth')`;
  assert.equal(existing.count, 0, "Test database must be empty; this script never resets it");
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter((entry) => entry.idx < 4)) {
    const source = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    for (const statement of source.split("--> statement-breakpoint")) if (statement.trim()) await sql.unsafe(statement);
  }
  const teacher = randomUUID();
  await sql`insert into better_auth.users (id, name, email, username, role) values (${teacher}, 'Migration fixture', 'migration@example.local', 'migration.fixture', 'อาจารย์')`;
  const [round] = await sql`insert into app.exam_rounds (name, academic_year, semester, created_by) values ('Migration fixture', '2569', '1', ${teacher}) returning id`;
  const [subject] = await sql`insert into app.subjects (round_id, course_code, course_name, group_no, instructor_id) values (${round.id}, 'MIGRATION', 'Legacy fixture', '1', ${teacher}) returning id`;
  const [room] = await sql`insert into app.rooms (code, name, capacity) values ('MIGRATION', 'Legacy room', 40) returning id`;
  const [schedule] = await sql`insert into app.exam_rooms (subject_id, room_id, exam_date, starts_at, ends_at, student_count) values (${subject.id}, ${room.id}, '2026-01-01', '09:00', '11:00', 30) returning id`;
  const [request] = await sql`insert into app.exam_requests (request_no, subject_id, instructor_id, page_count, status) values ('MIGRATION-FIXTURE', ${subject.id}, ${teacher}, 1, 'พิมพ์เสร็จแล้ว') returning id`;
  const [allocation] = await sql`insert into app.request_rooms (request_id, exam_room_id, room_code, room_name, exam_date, starts_at, ends_at, student_count, reserve_count, print_count, sender_name) values (${request.id}, ${schedule.id}, 'MIGRATION', 'Legacy room', '2026-01-01', '09:00', '11:00', 30, 2, 32, 'Migration fixture') returning id`;
  await sql`insert into app.print_jobs (request_id, operator_id, status, total_copies) values (${request.id}, ${teacher}, 'พิมพ์เสร็จแล้ว', 32)`;
  const [delivery] = await sql`insert into app.deliveries (request_id, sender_id, receiver_id, receiver_name_snapshot, signature_storage_key, delivered_at, note) values (${request.id}, ${teacher}, ${teacher}, 'Migration fixture', 'legacy-signature/fixture.png', '2026-01-01T02:00:00Z', 'Legacy handover fixture') returning id`;
  const [distribution] = await sql`insert into app.distributions (delivery_id, request_room_id, distributed_by, note) values (${delivery.id}, ${allocation.id}, ${teacher}, 'Legacy distribution fixture') returning id`;
  for (const entry of journal.entries.filter((entry) => entry.idx >= 4)) {
    const source = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    if (entry.idx === 5) {
      // An unexpected dependency must abort the entire retirement, not cascade-delete it.
      await sql`create view app.cleanup_dependency_fixture as select id from app.deliveries`;
      await assert.rejects(sql.begin(async (tx) => {
        for (const statement of source.split("--> statement-breakpoint")) if (statement.trim()) await tx.unsafe(statement);
      }), (error: unknown) => error instanceof Error && 'code' in error && error.code === '2BP01');
      const [rollback] = await sql`select count(*)::int as count from app.audit_logs where metadata->>'migration' = '0005_retire_delivery_distribution'`;
      assert.equal(rollback.count, 0, 'Archives must roll back with failed DROP');
      const [retained] = await sql`select (select count(*)::int from app.deliveries) as deliveries, (select count(*)::int from app.distributions) as distributions`;
      assert.equal(retained.deliveries, 1); assert.equal(retained.distributions, 1);
      await sql`drop view app.cleanup_dependency_fixture`;
    }
    await sql.begin(async (tx) => { for (const statement of source.split("--> statement-breakpoint")) if (statement.trim()) await tx.unsafe(statement); });
  }
  const [after] = await sql`select student_count, base_copy_count, reserve_count, print_count from app.request_rooms where id=${allocation.id}`;
  assert.deepEqual({ ...after }, { student_count: 30, base_copy_count: 30, reserve_count: 2, print_count: 32 });
  const [job] = await sql`select total_copies, selected_exam_file_id, confirmed_at from app.print_jobs where request_id=${request.id}`;
  assert.equal(job.total_copies, 32); assert.equal(job.selected_exam_file_id, null); assert.equal(job.confirmed_at, null);
  const [tables] = await sql`select count(*)::int as count from information_schema.tables where table_schema in ('app','better_auth')`;
  assert.equal(tables.count, 16);
  const [retired] = await sql`select to_regclass('app.deliveries') as deliveries, to_regclass('app.distributions') as distributions`;
  assert.equal(retired.deliveries, null); assert.equal(retired.distributions, null);
  const archives = await sql`select action, target_id, metadata from app.audit_logs where metadata->>'migration' = '0005_retire_delivery_distribution'`;
  assert.equal(archives.length, 2);
  const archivedDelivery = archives.find((row) => row.action === 'LEGACY_DELIVERY_ARCHIVED');
  const archivedDistribution = archives.find((row) => row.action === 'LEGACY_DISTRIBUTION_ARCHIVED');
  assert.equal(archivedDelivery?.target_id, request.id);
  assert.equal(archivedDelivery?.metadata.legacy_record.id, delivery.id);
  assert.equal(archivedDelivery?.metadata.legacy_record.signature_storage_key, 'legacy-signature/fixture.png');
  assert.equal(archivedDelivery?.metadata.receiver.username, 'migration.fixture');
  assert.equal(archivedDistribution?.metadata.legacy_record.id, distribution.id);
  assert.equal(archivedDistribution?.metadata.legacy_record.delivery_id, delivery.id);
  assert.equal(archivedDistribution?.metadata.legacy_record.request_room_id, allocation.id);
  console.log("PASS: legacy migration preserves quantities, files and handover history; 16 tables.");
} finally { await sql.end(); }
