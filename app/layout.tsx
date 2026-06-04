import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paradise Staff Hub",
  description: "HR hub interno per Paradise Beauty",
  applicationName: "Paradise Staff Hub",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/paradise-icon.svg",
    shortcut: "/icons/paradise-icon.svg",
    apple: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Paradise Hub",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
