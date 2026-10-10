import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: "MyParadise",
  description: "Chat e chiamate del team Paradise Beauty.",
  manifest: "/my-staff.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MyParadise",
    statusBarStyle: "default",
  },
  icons: { icon: "/my-staff/icon.png", shortcut: "/my-staff/icon.png", apple: "/my-staff/apple-icon.png" },
};

export default function MyStaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
