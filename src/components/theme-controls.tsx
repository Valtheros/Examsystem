"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange storageKey="exam-theme">{children}</ThemeProvider>;
}

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return <Button type="button" variant="ghost" size="icon" aria-label="สลับโหมดสี" title="สลับโหมดสว่าง / มืด" onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}><Moon className="size-5 dark:hidden" /><Sun className="hidden size-5 dark:block" /></Button>;
}

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} richColors closeButton position="top-right" toastOptions={{ duration: 5000 }} />;
}
