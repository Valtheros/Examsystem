// Read catalog metadata only. Never exports account rows, tokens, or exam contents.
import postgres from "postgres";
import { mkdir, writeFile } from "node:fs/promises";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://exam_app:exam_local_password@localhost:5432/examsystem");
if (url.hostname !== "localhost" || url.pathname !== "/examsystem") throw new Error("Expected the project's local Docker database");
const sql = postgres(url.toString(), { max: 1, prepare: false });
try {
  const catalog = await sql.begin("read only", async (tx) => {
    const tables = await tx`select table_schema, table_name from information_schema.tables where table_schema in ('app','better_auth','drizzle') and table_type='BASE TABLE' order by table_schema, table_name`;
    const columns = await tx`select table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema in ('app','better_auth') order by table_schema,table_name,ordinal_position`;
    const foreignKeys = await tx`select ns.nspname as child_schema,t.relname as child,a.attname as column_name,pns.nspname as parent_schema,p.relname as parent,pa.attname as parent_column,a.attnotnull as required,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace ns on ns.oid=t.relnamespace join pg_class p on p.oid=c.confrelid join pg_namespace pns on pns.oid=p.relnamespace join pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1] join pg_attribute pa on pa.attrelid=p.oid and pa.attnum=c.confkey[1] where c.contype='f' and ns.nspname in ('app','better_auth') order by child_schema,child,column_name`;
    const indexes = await tx`select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('app','better_auth') order by schemaname,tablename,indexname`;
    const checks = await tx`select ns.nspname as schema_name,t.relname as table_name,c.conname,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace ns on ns.oid=t.relnamespace where c.contype='c' and ns.nspname in ('app','better_auth') order by schema_name,table_name,c.conname`;
    const enums = await tx`select ns.nspname as schema_name,t.typname as type_name,e.enumlabel as label from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace ns on ns.oid=t.typnamespace where ns.nspname='app' order by t.typname,e.enumsortorder`;
    const [migration] = await tx`select count(*)::int as applied_migrations from drizzle.__drizzle_migrations`;
    return { checkedOn: "2026-10-04", source: "local PostgreSQL catalog (read-only)", tables, columns, foreignKeys, indexes, checks, enums, migration };
  });
  const managed = catalog.tables.filter((table) => table.table_schema !== "drizzle");
  if (managed.length !== 16 || catalog.foreignKeys.length !== 24) throw new Error("Schema changed: review the report model before authoring");
  await mkdir("tmp/pdfs/database-report", { recursive: true });
  await writeFile("tmp/pdfs/database-report/catalog.json", JSON.stringify(catalog, null, 2));
  console.log(`Read-only inspection: ${managed.length} tables, ${catalog.foreignKeys.length} foreign keys, ${catalog.migration.applied_migrations} applied migrations.`);
} finally {
  await sql.end();
}
