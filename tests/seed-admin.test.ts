import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  end: vi.fn(),
  hashPassword: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("postgres", () => ({ default: () => ({ end: mocks.end }) }));
vi.mock("better-auth/crypto", () => ({ hashPassword: mocks.hashPassword }));
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
  mocks.values.mockResolvedValue(undefined);
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.transaction.mockImplementation(async (callback) => callback({ insert: mocks.insert }));
});

afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Docker administrator bootstrap", () => {
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
});
