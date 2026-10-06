import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://exam_app:exam_local_password@localhost:5432/examsystem";

const client = postgres(databaseUrl, {
  prepare: false,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
