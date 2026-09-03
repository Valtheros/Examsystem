import { describe, expect, it } from "vitest";

import { REQUEST_STATUSES, ROLES } from "@/lib/constants";
import {
  assertRequestTransition,
  canDownloadExamFile,
  canEditRequest,
} from "@/lib/permissions";

describe("request authorization", () => {
  it("allows an instructor to edit only their draft or returned request", () => {
    expect(
      canEditRequest({
        role: ROLES.INSTRUCTOR,
        userId: "teacher-1",
        instructorId: "teacher-1",
        status: REQUEST_STATUSES.DRAFT,
      }),
    ).toBe(true);
    expect(
      canEditRequest({
        role: ROLES.INSTRUCTOR,
        userId: "teacher-1",
        instructorId: "teacher-1",
        status: REQUEST_STATUSES.CUTTING,
      }),
    ).toBe(false);
    expect(
      canEditRequest({
        role: ROLES.INSTRUCTOR,
        userId: "teacher-2",
        instructorId: "teacher-1",
        status: REQUEST_STATUSES.DRAFT,
      }),
    ).toBe(false);
  });

  it("blocks invalid transitions and role escalation", () => {
    expect(() =>
      assertRequestTransition(
        REQUEST_STATUSES.DRAFT,
        REQUEST_STATUSES.PENDING_REVIEW,
        ROLES.INSTRUCTOR,
        true,
      ),
    ).not.toThrow();
    expect(() =>
      assertRequestTransition(
        REQUEST_STATUSES.DRAFT,
        REQUEST_STATUSES.PRINTING,
        ROLES.INSTRUCTOR,
        true,
      ),
    ).toThrow();
    expect(() =>
      assertRequestTransition(
        REQUEST_STATUSES.PENDING_REVIEW,
        REQUEST_STATUSES.CUTTING,
        ROLES.OFFICER,
        false,
      ),
    ).toThrow();
  });

  it("limits exam downloads by owner, role, and workflow window", () => {
    expect(
      canDownloadExamFile({
        role: ROLES.INSTRUCTOR,
        userId: "teacher-1",
        instructorId: "teacher-1",
        status: REQUEST_STATUSES.PENDING_REVIEW,
      }),
    ).toBe(true);
    expect(
      canDownloadExamFile({
        role: ROLES.OFFICER,
        userId: "officer",
        instructorId: "teacher-1",
        status: REQUEST_STATUSES.CUTTING,
      }),
    ).toBe(false);
    expect(
      canDownloadExamFile({
        role: ROLES.AV_UNIT,
        userId: "av",
        instructorId: "teacher-1",
        status: REQUEST_STATUSES.PRINTED,
      }),
    ).toBe(true);
    expect(
      canDownloadExamFile({
        role: ROLES.AV_UNIT,
        userId: "av",
        instructorId: "teacher-1",
        status: REQUEST_STATUSES.DELIVERED,
      }),
    ).toBe(false);
  });
});
