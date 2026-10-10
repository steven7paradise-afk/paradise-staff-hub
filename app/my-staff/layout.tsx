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
  icons: { apple: "/icon-192.png" },
};

export default function MyStaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
