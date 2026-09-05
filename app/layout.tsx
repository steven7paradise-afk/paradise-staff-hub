import type { Metadata, Viewport } from "next";
import { AppVersionWatcher } from "@/components/app-version-watcher";
import { RemoteScreenShare } from "@/components/remote-screen-share";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paradise Staff Hub",
  description: "HR hub interno per Paradise Beauty",
  applicationName: "Paradise Staff Hub",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Paradise Hub",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7e9ef",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentVersion = process.env.NEXT_PUBLIC_APP_BUILD_VERSION || "unknown";
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <AppVersionWatcher currentVersion={currentVersion} />
        <RemoteScreenShare />
        {children}
      </body>
    </html>
  );
}
