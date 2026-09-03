import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  account,
  auditLogs,
  coverSheets,
  deliveries,
  distributions,
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
  it("contains exactly the 18 planned application-managed tables", () => {
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
      deliveries,
      distributions,
      notifications,
      requestStatusHistory,
      auditLogs,
    ].map(getTableName);
    expect(names).toHaveLength(18);
    expect(new Set(names).size).toBe(18);
  });
});
