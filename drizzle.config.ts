import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DIRECT_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://exam_app:exam_local_password@localhost:5432/examsystem",
  },
  strict: true,
  verbose: true,
});
