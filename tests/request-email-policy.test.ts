import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ after: vi.fn(), transition: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/mail", () => ({ sendQueuedEmail: mocks.send }));
vi.mock("@/lib/session", () => ({ requireSession: async () => ({ user: { id: "operator", username: "operator", role: "หน่วยโสต" } }), requireRole: vi.fn() }));
vi.mock("@/lib/workflow", () => ({ transitionRequest: mocks.transition }));
import { transitionRequestAction } from "@/actions/requests";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transition.mockResolvedValue({ request: { id: "request" }, notificationIds: ["teacher-notification"] });
  mocks.send.mockResolvedValue({ status: "Sent" });
});
const input = (status: string) => {
  const form = new FormData(); form.set("requestId", "00000000-0000-4000-8000-000000000001");
  form.set("toStatus", status); form.set("reason", "เหตุผลทดสอบ"); return form;
};
describe("exam email policy", () => {
  it.each(["รอตรวจสอบ", "ตัดข้อสอบ", "ปฏิเสธ/ส่งกลับแก้ไข", "กำลังพิมพ์", "พิมพ์เสร็จแล้ว"])("schedules mail only for print completion (%s)", async status => {
    await transitionRequestAction(input(status));
    expect(mocks.send).not.toHaveBeenCalled();
    if (status === "พิมพ์เสร็จแล้ว") {
      expect(mocks.after).toHaveBeenCalledOnce();
      await mocks.after.mock.calls[0][0]();
      expect(mocks.send).toHaveBeenCalledExactlyOnceWith("teacher-notification");
    } else expect(mocks.after).not.toHaveBeenCalled();
  });
  it("does not send or schedule mail when the transaction fails", async () => {
    mocks.transition.mockRejectedValueOnce(new Error("rollback"));
    await expect(transitionRequestAction(input("พิมพ์เสร็จแล้ว"))).rejects.toThrow("rollback");
    expect(mocks.after).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
});
