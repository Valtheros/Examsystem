// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { InstructorNotificationsProvider, InstructorNotificationSummary } from "@/components/instructor-notifications";
import { RetryEmailButton } from "@/components/retry-email-button";
import type { InstructorNotification } from "@/lib/notification-types";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
const original: InstructorNotification = { id: "initial", requestId: "request-1", requestNo: "REQ-1", courseCode: "344-321", courseName: "วิชาทดสอบ", status: "ตัดข้อสอบ", reason: null, createdAt: "2026-10-06T10:00:00.000Z" };
let records: InstructorNotification[];
let hidden: boolean;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); hidden = false; records = [original];
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ notifications: records }) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount() {
  render(createElement(InstructorNotificationsProvider, { userId: "teacher", initialNotifications: [original] }, createElement("div", null, createElement(InstructorNotificationSummary), createElement("input", { "aria-label": "ร่างที่กำลังกรอก", defaultValue: "ไม่หาย" }))));
}
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

describe("instructor notification updates", () => {
  it("does not toast old history, updates every 30 seconds without refreshing a form, and deduplicates new events", async () => {
    mount(); await settle();
    expect(toast.info).not.toHaveBeenCalled();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/dashboard/requests/request-1");
    records = [{ ...original, id: "new", status: "พิมพ์เสร็จแล้ว" }, original];
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("ร่างที่กำลังกรอก") as HTMLInputElement).value).toBe("ไม่หาย");
    expect(router.refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(toast.success).toHaveBeenCalledTimes(1);
    const action = vi.mocked(toast.success).mock.calls[0][1]?.action;
    if (action && typeof action === "object" && "onClick" in action) action.onClick({} as never);
    expect(router.push).toHaveBeenCalledWith("/dashboard/requests/request-1");
  });
  it("pauses while hidden, checks immediately on return, and keeps only three summary rows", async () => {
    mount(); await settle();
    hidden = true; fireEvent(document, new Event("visibilitychange"));
    const calls = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    records = [1, 2, 3, 4].map(id => ({ ...original, id: String(id), status: "ปฏิเสธ/ส่งกลับแก้ไข", reason: "กรุณาแก้ไฟล์" }));
    hidden = false; fireEvent(document, new Event("visibilitychange")); await settle();
    expect(fetchMock).toHaveBeenCalledTimes(calls + 1);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
  it("keeps previous records on network failure and removes them when the session expires", async () => {
    mount(); await settle();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(screen.getByRole("status").textContent).toContain("เก็บรายการเดิม");
    expect(screen.getByRole("link")).toBeTruthy();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("does not report a successful retry for HTTP 200 with ok=false", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "SMTP ไม่สำเร็จ" }) });
    render(createElement(RetryEmailButton, { id: "notification" }));
    fireEvent.click(screen.getByRole("button")); await settle();
    expect(toast.error).toHaveBeenCalledWith("SMTP ไม่สำเร็จ");
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
