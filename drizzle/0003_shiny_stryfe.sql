DROP INDEX "better_auth"."accounts_provider_account_uidx";--> statement-breakpoint
ALTER TABLE "better_auth"."accounts" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "better_auth"."accounts"
SET "issuer" = CASE
  WHEN "provider_id" = 'credential' THEN 'local:credential'
  ELSE 'local:oauth:' || "provider_id"
END;--> statement-breakpoint
ALTER TABLE "better_auth"."accounts" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_uidx" ON "better_auth"."accounts" USING btree ("issuer","account_id");
