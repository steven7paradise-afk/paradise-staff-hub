import type { Metadata } from "next";
import { TabletClock } from "@/components/tablet-clock";
import { cookies, headers } from "next/headers";
import { getBrandingTheme } from "@/lib/branding";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBrandingTheme();
  return {
    title: "Paradise Beauty",
    appleWebApp: {
      capable: true,
      title: "Paradise Beauty",
      statusBarStyle: "default",
    },
    icons: branding.logo_url
      ? {
          icon: branding.logo_url,
          apple: branding.logo_url,
        }
      : undefined,
  };
}

export default async function TabletClockPage({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  const params = await searchParams;
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const requestedDevice = params.device ?? cookieStore.get(tabletDeviceCookieName)?.value ?? "";
  const [device, branding] = await Promise.all([
    authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)),
    getBrandingTheme(),
  ]);

  return (
    <TabletClock
      device={device ? {
        id: device.device_id,
        name: device.device_name,
        locationName: device.location.name,
      } : null}
      branding={branding}
    />
  );
}
