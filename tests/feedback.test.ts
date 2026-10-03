// @vitest-environment jsdom
import { createElement, StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionMessage } from "@/components/action-message";
import { FactoryResetForm } from "@/components/factory-reset-form";
import { ImpersonateButton } from "@/components/impersonation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/auth-client", () => ({ authClient: { admin: { impersonateUser: vi.fn() }, useSession: vi.fn(() => ({ data: null })) } }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("form feedback", () => {
  it("toasts success once under StrictMode and again for a new successful submission", () => {
    const state = { ok: true, message: "บันทึกแล้ว" };
    const tree = (value: typeof state) => createElement(StrictMode, null, createElement(ActionMessage, { state: value }));
    const view = render(tree(state));
    expect(toast.success).toHaveBeenCalledTimes(1);
    view.rerender(tree(state));
    expect(toast.success).toHaveBeenCalledTimes(1);
    view.rerender(tree({ ...state }));
    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("keeps validation errors visible instead of transient toasts", () => {
    render(createElement(ActionMessage, { state: { ok: false, message: "ตรวจสอบข้อมูล", fieldErrors: { name: ["กรอกชื่อ"] } } }));
    expect(screen.getByRole("alert").textContent).toContain("กรอกชื่อ");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("impersonation confirmation", () => {
  it("cancel does not send a request", () => {
    render(createElement(ImpersonateButton, { userId: "teacher", username: "teacher" }));
    fireEvent.click(screen.getByRole("button", { name: "เข้าใช้งานแทน" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(authClient.admin.impersonateUser).not.toHaveBeenCalled();
  });
  it("blocks duplicate submissions and keeps a failed request in the dialog for retry", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(authClient.admin.impersonateUser).mockImplementation(() => new Promise(done => { resolve = done; }) as never);
    render(createElement(ImpersonateButton, { userId: "teacher", username: "teacher" }));
    fireEvent.click(screen.getByRole("button", { name: "เข้าใช้งานแทน" }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันเข้าใช้งานแทน" }));
    fireEvent.click(screen.getByRole("button", { name: "กำลังเข้าใช้งาน..." }));
    expect(authClient.admin.impersonateUser).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    resolve({ error: { message: "บัญชีถูกปิด" } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("บัญชีถูกปิด"));
    expect(screen.getByRole("button", { name: "ยืนยันเข้าใช้งานแทน" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("factory reset feedback (mocked, never resets real data)", () => {
  function open() {
    render(createElement(FactoryResetForm));
    fireEvent.change(screen.getByLabelText("รหัสผ่านปัจจุบัน"), { target: { value: "temporary-test-password" } });
    fireEvent.change(screen.getByLabelText("พิมพ์ RESET EXAM SYSTEM"), { target: { value: "RESET EXAM SYSTEM" } });
    fireEvent.click(screen.getByRole("button", { name: "Factory Reset" }));
  }
  it("requires explicit confirmation and cancellation is non-destructive", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    open();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [false, { message: "รหัสผ่านไม่ถูกต้อง" }, "error", "รหัสผ่านไม่ถูกต้อง"],
    [true, { ok: true, deletedFiles: 3 }, "success", "รีเซ็ตสำเร็จ ลบไฟล์ 3 รายการ"],
    [true, { ok: false, storagePending: true }, "warning", "ล้างข้อมูลแล้ว แต่ยังมีไฟล์ตกค้าง กรุณาลองล้างไฟล์อีกครั้ง"],
  ] as const)("handles response %j / %j", async (ok, result, kind, message) => {
    const fetch = vi.fn().mockResolvedValue({ ok, json: async () => result }); vi.stubGlobal("fetch", fetch);
    open(); fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
    await waitFor(() => expect(toast[kind]).toHaveBeenCalledWith(message));
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    if (kind === "warning") {
      fireEvent.click(screen.getByRole("button", { name: "ลองล้างไฟล์ตกค้างอีกครั้ง" }));
      fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(JSON.parse(fetch.mock.calls[1][1].body).storageOnly).toBe(true);
    }
  });
  it("reports network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("เชื่อมต่อไม่ได้")));
    open(); fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("เชื่อมต่อไม่ได้"));
  });
  it("preserves storage-only retry after an authentication error", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, storagePending: true }) })
      .mockResolvedValue({ ok: false, json: async () => ({ message: "รหัสผ่านไม่ถูกต้อง" }) });
    vi.stubGlobal("fetch", fetch);
    open(); fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "ลองล้างไฟล์ตกค้างอีกครั้ง" }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("รหัสผ่านไม่ถูกต้อง"));
    expect(screen.getByRole("button", { name: "ลองล้างไฟล์ตกค้างอีกครั้ง" })).toBeTruthy();
    expect(JSON.parse(fetch.mock.calls[1][1].body).storageOnly).toBe(true);
  });
});
