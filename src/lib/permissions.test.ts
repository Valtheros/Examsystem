import { describe, expect, it } from "vitest";

import { LEGACY_DELIVERED_STATUS, REQUEST_STATUSES, ROLES } from "@/lib/constants";
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
        status: LEGACY_DELIVERED_STATUS,
      }),
    ).toBe(false);
  });

  it("ends at printed and prevents the removed handover transition", () => {
    expect(() => assertRequestTransition(REQUEST_STATUSES.PRINTING, REQUEST_STATUSES.PRINTED, ROLES.AV_UNIT, false)).not.toThrow();
    expect(() => assertRequestTransition(REQUEST_STATUSES.PRINTED, LEGACY_DELIVERED_STATUS, ROLES.AV_UNIT, false)).toThrow();
    expect(() => assertRequestTransition(LEGACY_DELIVERED_STATUS, REQUEST_STATUSES.PRINTING, ROLES.AV_UNIT, false)).toThrow();
  });
});
