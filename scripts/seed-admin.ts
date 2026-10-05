import { randomUUID } from "node:crypto";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { account, session, user } from "../src/db/schema/auth";
import { auditLogs } from "../src/db/schema/domain";
import { passwordSchema } from "../src/lib/validation";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const databaseUrl = required("DIRECT_DATABASE_URL");
const client = postgres(databaseUrl, { max: 1, prepare: false });
const database = drizzle(client);

async function seedAdministrator() {
  const syncExisting = process.argv.includes("--sync-existing");
  if (process.argv.includes("--if-empty") && !syncExisting) {
    const [administrator] = await database
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "ผู้ดูแลระบบ"))
      .limit(1);
    if (administrator) {
      console.log("An administrator already exists; bootstrap skipped.");
      return;
    }
  }

  const username = required("BOOTSTRAP_ADMIN_USERNAME").toLowerCase();
  const [existing] = await database
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  if (existing) {
    if (existing.role !== "ผู้ดูแลระบบ") {
      throw new Error("BOOTSTRAP_ADMIN_USERNAME belongs to a non-administrator account");
    }
    if (!syncExisting) {
      console.log(`Administrator ${username} already exists; no changes made.`);
      return;
    }
    const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
    const name = required("BOOTSTRAP_ADMIN_NAME");
    const password = passwordSchema.parse(required("BOOTSTRAP_ADMIN_PASSWORD"));
    const passwordChanged = await database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(921001)`);
      const credentials = await tx
        .select()
        .from(account)
        .where(and(eq(account.userId, existing.id), eq(account.providerId, "credential")))
        .limit(2);
      if (credentials.length > 1) throw new Error("Administrator has multiple password accounts");
      const credential = credentials[0];
      const changed = !credential?.password || !(await verifyPassword({
        hash: credential.password,
        password,
      }));
      if (changed) {
        const passwordHash = await hashPassword(password);
        if (credential) {
          await tx.update(account)
            .set({ password: passwordHash, updatedAt: new Date() })
            .where(eq(account.id, credential.id));
        } else {
          await tx.insert(account).values({
            id: randomUUID(),
            issuer: "local:credential",
            accountId: existing.id,
            providerId: "credential",
            userId: existing.id,
            password: passwordHash,
          });
        }
        await tx.delete(session).where(or(
          eq(session.userId, existing.id),
          eq(session.impersonatedBy, existing.id),
        ));
        await tx.insert(auditLogs).values({
          actorId: existing.id,
          actorUsernameSnapshot: username,
          actorRoleSnapshot: existing.role,
          action: "USER_PASSWORD_RESET",
          targetType: "user",
          targetId: existing.id,
          metadata: { source: "docker_bootstrap_sync" },
        });
      }
      await tx.update(user).set({
        email,
        name,
        banned: false,
        banReason: null,
        banExpires: null,
        ...(changed ? { mustChangePassword: true } : {}),
        updatedAt: new Date(),
      }).where(eq(user.id, existing.id));
      return changed;
    });
    console.log(`Administrator ${username} synchronized from environment (${passwordChanged ? "password updated and previous sessions revoked" : "password already matches"}). Password was not printed.`);
  } else {
    const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
    const name = required("BOOTSTRAP_ADMIN_NAME");
    const password = required("BOOTSTRAP_ADMIN_PASSWORD");
    if (password.length < 12) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must have at least 12 characters");
    }
    passwordSchema.parse(password);
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await database.transaction(async (tx) => {
      await tx.insert(user).values({
        id,
        name,
        email,
        emailVerified: true,
        username,
        displayUsername: username,
        role: "ผู้ดูแลระบบ",
        banned: false,
        mustChangePassword: true,
      });
      await tx.insert(account).values({
        id: randomUUID(),
        issuer: "local:credential",
        accountId: id,
        providerId: "credential",
        userId: id,
        password: passwordHash,
      });
    });
    console.log(`Administrator ${username} created. Password was not printed.`);
  }
}

try {
  await seedAdministrator();
} finally {
  await client.end();
}
