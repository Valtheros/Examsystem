-- Run through Drizzle's transactional migrator. Never drop dependent objects via CASCADE.
SET LOCAL lock_timeout = '10s';--> statement-breakpoint
SELECT pg_advisory_xact_lock(921001);--> statement-breakpoint
LOCK TABLE "app"."deliveries", "app"."distributions" IN ACCESS EXCLUSIVE MODE;--> statement-breakpoint
-- Keep complete legacy rows and participant snapshots in the existing audit table.
INSERT INTO "app"."audit_logs"
  (actor_id, actor_username_snapshot, actor_role_snapshot, action, target_type, target_id, metadata, created_at)
SELECT d.sender_id, sender.username, sender.role, 'LEGACY_DELIVERY_ARCHIVED', 'exam_request', d.request_id::text,
  jsonb_build_object(
    'migration', '0005_retire_delivery_distribution', 'source_table', 'app.deliveries',
    'legacy_record', to_jsonb(d), 'archived_at', CURRENT_TIMESTAMP,
    'sender', jsonb_build_object('id', sender.id, 'username', sender.username, 'name', sender.name, 'role', sender.role),
    'receiver', jsonb_build_object('id', receiver.id, 'username', receiver.username, 'name', receiver.name, 'role', receiver.role)
  ), d.delivered_at
FROM "app"."deliveries" d
JOIN "better_auth"."users" sender ON sender.id = d.sender_id
JOIN "better_auth"."users" receiver ON receiver.id = d.receiver_id;--> statement-breakpoint
INSERT INTO "app"."audit_logs"
  (actor_id, actor_username_snapshot, actor_role_snapshot, action, target_type, target_id, metadata, created_at)
SELECT x.distributed_by, officer.username, officer.role, 'LEGACY_DISTRIBUTION_ARCHIVED', 'exam_request', d.request_id::text,
  jsonb_build_object(
    'migration', '0005_retire_delivery_distribution', 'source_table', 'app.distributions',
    'legacy_record', to_jsonb(x), 'archived_at', CURRENT_TIMESTAMP,
    'officer', jsonb_build_object('id', officer.id, 'username', officer.username, 'name', officer.name, 'role', officer.role)
  ), x.distributed_at
FROM "app"."distributions" x
JOIN "app"."deliveries" d ON d.id = x.delivery_id
JOIN "better_auth"."users" officer ON officer.id = x.distributed_by;--> statement-breakpoint
-- Fail and roll back if any legacy row was not archived exactly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "app"."deliveries" d WHERE NOT EXISTS (
      SELECT 1 FROM "app"."audit_logs" a
      WHERE a.action = 'LEGACY_DELIVERY_ARCHIVED'
        AND a.metadata->>'migration' = '0005_retire_delivery_distribution'
        AND a.metadata->'legacy_record' = to_jsonb(d)
    )
  ) OR EXISTS (
    SELECT 1 FROM "app"."distributions" x WHERE NOT EXISTS (
      SELECT 1 FROM "app"."audit_logs" a
      WHERE a.action = 'LEGACY_DISTRIBUTION_ARCHIVED'
        AND a.metadata->>'migration' = '0005_retire_delivery_distribution'
        AND a.metadata->'legacy_record' = to_jsonb(x)
    )
  ) THEN
    RAISE EXCEPTION 'Legacy delivery history was not fully archived; refusing to drop tables';
  END IF;
END $$;--> statement-breakpoint
DROP TABLE "app"."distributions";--> statement-breakpoint
DROP TABLE "app"."deliveries";
