import { beforeEach, expect, it, vi } from "vitest";
import { transitionRequestAction } from "@/actions/requests";
import { transitionWithFeedback } from "@/actions/workflow-feedback";
import { ConflictError } from "@/lib/errors";

vi.mock("@/actions/requests", () => ({ transitionRequestAction: vi.fn() }));
const initial = { ok: false, message: "" };
beforeEach(() => vi.resetAllMocks());

it("returns workflow validation feedback instead of throwing a page error", async () => {
  vi.mocked(transitionRequestAction).mockRejectedValue(new ConflictError("กรุณาอัปโหลดไฟล์ข้อสอบก่อน"));
  await expect(transitionWithFeedback(initial, new FormData())).resolves.toEqual({ ok: false, message: "กรุณาอัปโหลดไฟล์ข้อสอบก่อน" });
});

it("reports successful print completion", async () => {
  vi.mocked(transitionRequestAction).mockResolvedValue(undefined);
  expect((await transitionWithFeedback(initial, new FormData())).ok).toBe(true);
});

it("does not expose unexpected internal error details", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(transitionRequestAction).mockRejectedValue(new Error("database internal secret"));
  const result = await transitionWithFeedback(initial, new FormData());
  expect(result.ok).toBe(false);
  expect(result.message).not.toContain("secret");
  log.mockRestore();
});
