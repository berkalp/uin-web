import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import AppTranslationRuntime from "@/components/i18n/AppTranslationRuntime";
import { getAppTranslationBundle } from "@/utils/i18n/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UIN — The Intent Network",
  description:
    "Tell UIN what you want to do, find people who want it too, and turn shared Intent into real-world Activity.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestedLocale =
    cookieStore.get("uin_locale")?.value ?? null;

  const translationBundle =
    await getAppTranslationBundle(requestedLocale);

  return (
    <html
      lang={translationBundle.locale || "en"}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col"
      >
        <AppTranslationRuntime
          bundle={translationBundle}
        />

        {children}
      </body>
    </html>
  );
}
