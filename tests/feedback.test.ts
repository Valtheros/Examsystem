// @vitest-environment jsdom
import { createElement, StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionMessage } from "@/components/action-message";
import { FactoryResetForm } from "@/components/factory-reset-form";
import { ImpersonateButton } from "@/components/impersonation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { PrintPlanForm } from "@/components/print-plan-form";
import { ResetPasswordForm } from "@/components/admin-forms";
import { buttonVariants } from "@/components/ui/button";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/auth-client", () => ({ authClient: { admin: { impersonateUser: vi.fn() }, useSession: vi.fn(() => ({ data: null })) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/actions/print-plan", () => ({ savePrintPlanAction: vi.fn() }));
vi.mock("@/components/file-upload", () => ({ FileUpload: () => null }));
vi.mock("@/actions/admin", () => ({ createUserAction: vi.fn(), updateUserAction: vi.fn(), resetUserPasswordAction: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("visible workflow and password controls", () => {
  it("keeps print editing visibly outlined and destructive actions solid", () => {
    render(createElement(PrintPlanForm, { requestId: "request", rooms: [{ id: "room", roomCode: "L1", studentCount: 50, baseCopyCount: 50, reserveCount: 1 }], files: [{ id: "file", originalFileName: "exam.pdf", kind: "ต้นฉบับ", version: 1 }], selectedFileId: "file", revision: 1, confirmed: true, coversReady: false }));
    const edit = screen.getByRole("button", { name: "แก้ไขไฟล์หรือจำนวน" });
    expect(edit.getAttribute("data-variant")).toBe("outline");
    fireEvent.click(edit);
    expect((screen.getByLabelText("จำนวนพิมพ์หลัก") as HTMLInputElement).value).toBe("50");
    expect(screen.getByRole("button", { name: "ยืนยันไฟล์และจำนวนพิมพ์" })).toBeTruthy();
    expect(buttonVariants({ variant: "destructive" }).split(" ")).toContain("bg-destructive");
    expect(buttonVariants({ variant: "destructive" }).split(" ")).toContain("text-destructive-foreground");
  });
  it.each([true, false])("allows an administrator to set a new password with the correct label (temporary=%j)", (isTemporary) => {
    render(createElement(ResetPasswordForm, { userId: "teacher", isTemporary }));
    const input = screen.getByLabelText(isTemporary ? "รหัสผ่านชั่วคราวใหม่" : "รหัสผ่านใหม่") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.value).toBe("");
    expect(input.minLength).toBe(12);
    expect(screen.getByRole("button", { name: isTemporary ? "ตั้งรหัสผ่านชั่วคราว" : "บันทึกรหัสผ่านใหม่" })).toBeTruthy();
  });
});

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
    fireEvent.click(screen.getByRole("button", { name: "Factory Reset" }));
    fireEvent.change(screen.getByLabelText("รหัสผ่านปัจจุบัน"), { target: { value: "temporary-test-password" } });
    fireEvent.change(screen.getByLabelText("พิมพ์ RESET EXAM SYSTEM"), { target: { value: "RESET EXAM SYSTEM" } });
  }
  function fillRetry() {
    fireEvent.click(screen.getByRole("button", { name: "ลองล้างไฟล์ตกค้างอีกครั้ง" }));
    fireEvent.change(screen.getByLabelText("รหัสผ่านปัจจุบัน"), { target: { value: "temporary-test-password" } });
    fireEvent.change(screen.getByLabelText("พิมพ์ RESET EXAM SYSTEM"), { target: { value: "RESET EXAM SYSTEM" } });
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
    expect(!!screen.queryByRole("alertdialog")).toBe(kind === "error");
    expect(fetch).toHaveBeenCalledTimes(1);
    if (kind === "warning") {
      fillRetry();
      fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(JSON.parse(fetch.mock.calls[1][1].body).storageOnly).toBe(true);
    }
  });
  it("reports network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("เชื่อมต่อไม่ได้")));
    open(); fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่"));
  });
  it("preserves storage-only retry after an authentication error", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, storagePending: true }) })
      .mockResolvedValue({ ok: false, json: async () => ({ message: "รหัสผ่านไม่ถูกต้อง" }) });
    vi.stubGlobal("fetch", fetch);
    open(); fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fillRetry();
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("รหัสผ่านไม่ถูกต้อง"));
    expect(JSON.parse(fetch.mock.calls[1][1].body).storageOnly).toBe(true);
  });
  it("keeps the exam-data scope separate, requires the exact phrase, and blocks duplicate requests", async () => {
    let resolve!: (value: unknown) => void;
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(done => { resolve = (value) => done(value as Response); }));
    vi.stubGlobal("fetch", fetch);
    render(createElement(FactoryResetForm, { scope: "exam-data" }));
    fireEvent.click(screen.getByRole("button", { name: "ล้างข้อมูลงานสอบ" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("ทุกคนยังใช้บัญชีและรหัสผ่านเดิมได้");
    const confirm = screen.getByRole("button", { name: "ยืนยันลบถาวร" });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("รหัสผ่านปัจจุบัน"), { target: { value: "temporary-test-password" } });
    fireEvent.change(screen.getByLabelText("พิมพ์ CLEAR EXAM DATA"), { target: { value: "RESET EXAM SYSTEM" } });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("พิมพ์ CLEAR EXAM DATA"), { target: { value: "CLEAR EXAM DATA" } });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ scope: "exam-data", storageOnly: false });
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    resolve({ ok: true, json: async () => ({ ok: true, deletedFiles: 2 }) });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith("ล้างข้อมูลงานสอบสำเร็จ เก็บผู้ใช้ทุกบัญชีไว้แล้ว ลบไฟล์ 2 รายการ");
  });
});
