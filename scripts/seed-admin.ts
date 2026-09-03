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
const username = required("BOOTSTRAP_ADMIN_USERNAME").toLowerCase();
const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const name = required("BOOTSTRAP_ADMIN_NAME");
const password = required("BOOTSTRAP_ADMIN_PASSWORD");

if (password.length < 12) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD must have at least 12 characters");
}

const client = postgres(databaseUrl, { max: 1, prepare: false });
const database = drizzle(client);

try {
  const [existing] = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  if (existing) {
    console.log(`Administrator ${username} already exists; no changes made.`);
  } else {
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
} finally {
  await client.end();
}
