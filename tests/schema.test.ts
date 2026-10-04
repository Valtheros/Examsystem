import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  account,
  auditLogs,
  coverSheets,
  examFiles,
  examRequests,
  examRooms,
  examRounds,
  notifications,
  printJobs,
  requestRooms,
  requestStatusHistory,
  rooms,
  session,
  subjects,
  user,
  verification,
} from "@/db/schema";

describe("database contract", () => {
  it("contains exactly the 16 tables needed by the current workflow", () => {
    const names = [
      user,
      session,
      account,
      verification,
      examRounds,
      subjects,
      rooms,
      examRooms,
      examRequests,
      requestRooms,
      examFiles,
      coverSheets,
      printJobs,
      notifications,
      requestStatusHistory,
      auditLogs,
    ].map(getTableName);
    expect(names).toHaveLength(16);
    expect(new Set(names).size).toBe(16);
    expect(names).not.toContain("deliveries");
    expect(names).not.toContain("distributions");
  });
});
