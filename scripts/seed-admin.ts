import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { account, user } from "../src/db/schema/auth";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const databaseUrl = required("DIRECT_DATABASE_URL");
const client = postgres(databaseUrl, { max: 1, prepare: false });
const database = drizzle(client);

async function seedAdministrator() {
  // Automatic Docker setup must never replace an existing administrator.
  if (process.argv.includes("--if-empty")) {
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
    console.log(`Administrator ${username} already exists; no changes made.`);
  } else {
    const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
    const name = required("BOOTSTRAP_ADMIN_NAME");
    const password = required("BOOTSTRAP_ADMIN_PASSWORD");
    if (password.length < 12) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must have at least 12 characters");
    }
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
