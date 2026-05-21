import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { AppThemeProvider } from "@/components/providers/app-theme-provider";
import { AppToaster } from "@/components/providers/app-toaster";
import { SupabaseRequiredGate } from "@/components/providers/supabase-required-gate";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { buildThemeInitScriptBody } from "@/lib/theme";

import "./globals.css";

const THEME_INIT_SCRIPT = buildThemeInitScriptBody();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bodyClassName = [
  geistSans.variable,
  geistMono.variable,
  "min-h-dvh antialiased text-foreground",
].join(" ");

export const metadata: Metadata = {
  title: "PunchIn - 스케줄 펀치",
  description: "휴대폰 번호로 빠르게 출퇴근을 기록하는 PWA",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon.png",
    apple: "/icons/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PunchIn",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={bodyClassName}>
        <Script
          id="punchin-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <AppThemeProvider>
          <AppToaster />
          <ServiceWorkerRegister />
          <SupabaseRequiredGate>{children}</SupabaseRequiredGate>
        </AppThemeProvider>
      </body>
    </html>
  );
}
