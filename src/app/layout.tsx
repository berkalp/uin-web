import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import AppTranslationRuntime from "@/components/i18n/AppTranslationRuntime";
import ReminderToastListener from "@/components/notifications/ReminderToastListener";
import GlobalAdminEditBar from "@/components/admin/GlobalAdminEditBar";
import { getAppTranslationBundle } from "@/utils/i18n/server";
import { getViewerContext } from "@/utils/viewerContext";

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
  const hasAuthSession = cookieStore
    .getAll()
    .some(
      ({ name }) =>
        name.startsWith("sb-") && name.includes("-auth-token")
    );

  const [translationBundle, viewerContext] = await Promise.all([
    getAppTranslationBundle(requestedLocale),
    hasAuthSession
      ? getViewerContext().catch(() => ({ user: null, adminRole: null }))
      : Promise.resolve({ user: null, adminRole: null }),
  ]);
  const adminRole = viewerContext.adminRole;

  return (
    <html
      data-theme="light"
      style={{colorScheme:"only light"}}
      lang={translationBundle.locale || "en"}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col"
      >
        <AppTranslationRuntime
          bundle={{
            ...translationBundle,
            messages: {},
            languages: [],
          }}
        />

        <ReminderToastListener enabled={Boolean(viewerContext.user)} />

        {children}

        {(adminRole === "owner" || adminRole === "admin") && <GlobalAdminEditBar role={adminRole} />}
      </body>
    </html>
  );
}
