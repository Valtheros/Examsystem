import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";
import { AppThemeProvider, AppToaster } from "@/components/theme-controls";

import { APP_NAME } from "@/lib/constants";
import { ImpersonationBanner } from "@/components/impersonation";

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
    "จัดการรอบสอบ ส่งต้นฉบับ ตรวจ และพิมพ์ข้อสอบพร้อมใบปะหน้าซองอย่างตรวจสอบย้อนหลังได้",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <AppThemeProvider>
          {children}
          <ImpersonationBanner />
          <AppToaster />
        </AppThemeProvider>
        {process.env.NODE_ENV === "development" && <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
