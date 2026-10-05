// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-controls";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

const theme = vi.hoisted(() => ({ setTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => theme }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { username: vi.fn() } } }));
afterEach(() => { cleanup(); document.documentElement.classList.remove("dark"); vi.clearAllMocks(); });

describe("restrained frontend design", () => {
  it("login branding omits the faculty line and uses the transparent logo", () => {
    render(createElement(Brand));
    expect(screen.queryByText("คณะวิทยาศาสตร์")).toBeNull();
    expect(screen.getByRole("img").getAttribute("src")).toContain("psu-logo-transparent.png");
  });
  it("shared branding never displays the faculty subtitle", () => {
    render(createElement(Brand));
    expect(screen.queryByText("คณะวิทยาศาสตร์")).toBeNull();
    expect(screen.getByText("ระบบจัดพิมพ์ข้อสอบ")).toBeTruthy();
  });
  it("theme toggle has an accessible name and chooses the opposite displayed theme", () => {
    render(createElement(ThemeToggle));
    const button = screen.getByRole("button", { name: "สลับโหมดสี" });
    fireEvent.click(button);
    expect(theme.setTheme).toHaveBeenLastCalledWith("dark");
    document.documentElement.classList.add("dark");
    fireEvent.click(button);
    expect(theme.setTheme).toHaveBeenLastCalledWith("light");
  });
  it("can reveal and hide a password without submitting or clearing the login form", () => {
    render(createElement(LoginForm, { nextPath: "/dashboard" }));
    const password = screen.getByLabelText("รหัสผ่าน") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "TestOnlyPassword123" } });
    expect(password.type).toBe("password");
    const reveal = screen.getByRole("button", { name: "แสดงรหัสผ่าน" });
    expect(reveal.getAttribute("type")).toBe("button");
    fireEvent.click(reveal);
    expect(password.type).toBe("text");
    expect(reveal.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "ซ่อนรหัสผ่าน" }));
    expect(password.type).toBe("password");
    expect(password.value).toBe("TestOnlyPassword123");
  });
  it("section defaults do not restore nested rounded cards or shadows", () => {
    const view = render(createElement(Card, null, createElement(CardTitle, null, "เตรียมพิมพ์"), createElement(CardContent, null, "จำนวนต่อห้อง")));
    expect(screen.getByRole("heading", { name: "เตรียมพิมพ์" }).tagName).toBe("H2");
    const section = view.container.querySelector('[data-slot="card"]')!;
    expect(section.className).toContain("border-t");
    expect(section.className).not.toMatch(/rounded|shadow|ring-1/);
  });
  it.each(["default", "sm", "xs", "icon"] as const)("button %s keeps a 44px default touch target", size => {
    render(createElement(Button, { size }, "ทำงานต่อ"));
    expect(screen.getByRole("button").className).toMatch(/min-h-11|size-11/);
  });
});
