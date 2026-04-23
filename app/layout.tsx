import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppThemeProvider } from "@/components/providers/app-theme-provider";
import { AppToaster } from "@/components/providers/app-toaster";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const THEME_STORAGE_KEY = "punchin-theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <head>
        <Script
          id="punchin-theme-init"
          strategy="beforeInteractive"
        >{`
(function () {
  var k = ${JSON.stringify(THEME_STORAGE_KEY)};
  var d = document.documentElement;
  try {
    var t = localStorage.getItem(k);
    d.classList.remove("light", "dark");
    if (t === "light" || t === "dark") {
      d.classList.add(t);
    } else {
      d.classList.add(
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      );
    }
  } catch (e) {
    d.classList.add("light");
  }
})();`}</Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased text-[var(--foreground)]`}
      >
        <AppThemeProvider>
          <AppToaster />
          <ServiceWorkerRegister />
          {children}
        </AppThemeProvider>
      </body>
    </html>
  );
}
