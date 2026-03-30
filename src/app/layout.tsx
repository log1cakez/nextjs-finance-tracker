import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ExtensionAttrCleanup } from "@/components/extension-attr-cleanup";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_DESCRIPTION, APP_PAGE_TITLE } from "@/lib/brand";
import { getPreferredCurrency } from "@/lib/preferences";
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
  title: APP_PAGE_TITLE,
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/midas%20no%20bg.png",
    shortcut: "/midas%20no%20bg.png",
    apple: "/midas%20no%20bg.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, preferredCurrency] = await Promise.all([
    auth(),
    getPreferredCurrency(),
  ]);
  const user = session?.user
    ? {
        email: session.user.email,
        name: session.user.name,
      }
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ExtensionAttrCleanup />
        <ThemeProvider>
          <div className="midas-page-bg flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
            <AppShell user={user} preferredCurrency={preferredCurrency}>
              {children}
            </AppShell>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
