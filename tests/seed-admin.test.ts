import { readFileSync } from "node:fs";
import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  end: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  where: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("postgres", () => ({ default: () => ({ end: mocks.end }) }));
vi.mock("better-auth/crypto", () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword }));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
    transaction: mocks.transaction,
  }),
}));

const originalArgv = [...process.argv];
const bootstrapFields = [
  "BOOTSTRAP_ADMIN_USERNAME",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ADMIN_PASSWORD",
] as const;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  process.argv = [...originalArgv, "--if-empty"];
  vi.stubEnv("DIRECT_DATABASE_URL", "postgresql://fixture:fixture@localhost/examsystem_test_seed");
  vi.stubEnv("BOOTSTRAP_ADMIN_USERNAME", "SystemAdmin");
  vi.stubEnv("BOOTSTRAP_ADMIN_EMAIL", "Admin@example.local");
  vi.stubEnv("BOOTSTRAP_ADMIN_NAME", "Test administrator");
  vi.stubEnv("BOOTSTRAP_ADMIN_PASSWORD", "DockerFixture123!");
  mocks.limit.mockResolvedValue([]);
  mocks.end.mockResolvedValue(undefined);
  mocks.hashPassword.mockResolvedValue("hashed-password");
  mocks.verifyPassword.mockResolvedValue(false);
  mocks.values.mockResolvedValue(undefined);
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.where.mockResolvedValue(undefined);
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.delete.mockReturnValue({ where: mocks.where });
  mocks.execute.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) => callback({
    insert: mocks.insert,
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
    update: mocks.update,
    delete: mocks.delete,
    execute: mocks.execute,
  }));
});

afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Docker administrator bootstrap", () => {
  it("never enables password synchronization in automatic Docker startup", () => {
    const compose = readFileSync(new URL("../compose.app.yaml", import.meta.url), "utf8");
    expect(compose).toContain("npm run db:seed-admin -- --if-empty");
    expect(compose).not.toContain("--sync-existing");
  });

  it("creates the first administrator and a hashed credential in one transaction", async () => {
    await import("../scripts/seed-admin");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.insert.mock.calls.map(([table]) => getTableName(table))).toEqual(["users", "accounts"]);
    expect(mocks.values).toHaveBeenNthCalledWith(1, expect.objectContaining({
      username: "systemadmin", email: "admin@example.local", role: "ผู้ดูแลระบบ", mustChangePassword: true,
    }));
    expect(mocks.values).toHaveBeenNthCalledWith(2, expect.objectContaining({
      providerId: "credential", password: "hashed-password",
    }));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("DockerFixture123!"));
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("skips setup when any administrator exists, even without bootstrap settings", async () => {
    mocks.limit.mockResolvedValueOnce([{ id: "existing-administrator" }]);
    for (const field of bootstrapFields) vi.stubEnv(field, undefined);
    await import("../scripts/seed-admin");
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledOnce();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("does not change the password of an existing account during manual bootstrap", async () => {
    process.argv = [...originalArgv];
    mocks.limit.mockResolvedValueOnce([{ id: "existing-administrator", role: "ผู้ดูแลระบบ" }]);
    vi.stubEnv("BOOTSTRAP_ADMIN_PASSWORD", undefined);
    await import("../scripts/seed-admin");
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not turn an existing non-administrator into an administrator", async () => {
    mocks.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "teacher", role: "อาจารย์" }]);
    await expect(import("../scripts/seed-admin")).rejects.toThrow("non-administrator");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("fails clearly on a fresh database if account settings are missing", async () => {
    vi.stubEnv("BOOTSTRAP_ADMIN_USERNAME", undefined);
    await expect(import("../scripts/seed-admin")).rejects.toThrow("Missing BOOTSTRAP_ADMIN_USERNAME");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("rejects short initial passwords before writing an account", async () => {
    vi.stubEnv("BOOTSTRAP_ADMIN_PASSWORD", "Short123");
    await expect(import("../scripts/seed-admin")).rejects.toThrow("at least 12 characters");
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("syncs an existing administrator password, revokes sessions and records an audit", async () => {
    process.argv = [...originalArgv, "--sync-existing"];
    mocks.limit.mockResolvedValueOnce([{ id: "existing-admin", role: "ผู้ดูแลระบบ" }])
      .mockResolvedValueOnce([{ id: "credential", password: "old-hash" }]);
    await import("../scripts/seed-admin");
    expect(mocks.verifyPassword).toHaveBeenCalledWith({ hash: "old-hash", password: "DockerFixture123!" });
    expect(mocks.update.mock.calls.map(([table]) => getTableName(table))).toEqual(["accounts", "users"]);
    expect(mocks.set).toHaveBeenNthCalledWith(1, expect.objectContaining({ password: "hashed-password" }));
    expect(mocks.set).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: "Test administrator", email: "admin@example.local", mustChangePassword: true }));
    expect(mocks.delete.mock.calls.map(([table]) => getTableName(table))).toEqual(["sessions"]);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_PASSWORD_RESET", targetId: "existing-admin", metadata: { source: "docker_bootstrap_sync" } }));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("DockerFixture123!"));
  });

  it("keeps sessions and password-change state if the env password already matches", async () => {
    process.argv = [...originalArgv, "--sync-existing"];
    mocks.limit.mockResolvedValueOnce([{ id: "existing-admin", role: "ผู้ดูแลระบบ" }])
      .mockResolvedValueOnce([{ id: "credential", password: "matching-hash" }]);
    mocks.verifyPassword.mockResolvedValue(true);
    await import("../scripts/seed-admin");
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledOnce();
    expect(mocks.set.mock.calls[0][0]).not.toHaveProperty("mustChangePassword");
  });

  it("restores a missing password credential for the configured administrator", async () => {
    process.argv = [...originalArgv, "--sync-existing"];
    mocks.limit.mockResolvedValueOnce([{ id: "existing-admin", role: "ผู้ดูแลระบบ" }]).mockResolvedValueOnce([]);
    await import("../scripts/seed-admin");
    expect(mocks.values).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: "existing-admin", providerId: "credential", password: "hashed-password" }));
    expect(mocks.delete).toHaveBeenCalledOnce();
  });

  it("refuses to overwrite a non-administrator during sync", async () => {
    process.argv = [...originalArgv, "--sync-existing"];
    mocks.limit.mockResolvedValueOnce([{ id: "teacher", role: "อาจารย์" }]);
    await expect(import("../scripts/seed-admin")).rejects.toThrow("non-administrator");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
