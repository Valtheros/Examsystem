import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { APP_NAME } from "@/lib/constants";

import "./globals.css";

const notoSansThai = localFont({
  src: "../../public/fonts/NotoSansThai.ttf",
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "จัดการรอบสอบ ส่งต้นฉบับ ตรวจ พิมพ์ ส่งมอบ และแจกจ่ายข้อสอบอย่างตรวจสอบย้อนหลังได้",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
