import { expect, it } from "vitest";
import { impersonationBlockReason } from "./impersonation-policy";
import { ROLES } from "./constants";

it("permits active non-admin accounts after their first password change", () => {
  for (const role of [ROLES.OFFICER, ROLES.INSTRUCTOR, ROLES.AV_UNIT]) expect(impersonationBlockReason({ role, banned: false, mustChangePassword: false })).toBeNull();
});
it("blocks administrator, inactive and first-login accounts", () => {
  expect(impersonationBlockReason({ role: ROLES.ADMIN })).toBeTruthy();
  expect(impersonationBlockReason({ role: ROLES.INSTRUCTOR, banned: true })).toBeTruthy();
  expect(impersonationBlockReason({ role: ROLES.INSTRUCTOR, mustChangePassword: true })).toBeTruthy();
});
