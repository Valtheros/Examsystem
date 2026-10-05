import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-controls";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5 sm:py-7">
        <Brand />
        <ThemeToggle />
      </header>
      <div className="flex flex-1 items-center py-6 sm:py-10">{children}</div>
      <footer className="pb-5 pt-4 text-center text-xs leading-6 text-muted-foreground sm:text-left">
        มหาวิทยาลัยสงขลานครินทร์ · ระบบจัดพิมพ์ข้อสอบ
      </footer>
    </main>
  );
}
