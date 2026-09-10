import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { TabletNfcClock } from "@/components/tablet-nfc-clock";
import {
  authorizedTablet,
  requestIp,
  tabletCookieName,
  tabletDeviceCookieName,
} from "@/lib/tablet-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Timbratura NFC | Paradise",
  description: "Timbratura automatica Paradise tramite badge NFC.",
  robots: { index: false, follow: false },
};

export default async function TabletNfcClockPage({
  searchParams,
}: {
  searchParams: Promise<{ badge?: string; device?: string }>;
}) {
  const params = await searchParams;
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const deviceId = params.device ?? cookieStore.get(tabletDeviceCookieName)?.value ?? "";
  const device = await authorizedTablet(
    deviceId,
    cookieStore.get(tabletCookieName)?.value,
    requestIp(headerStore),
  ).catch(() => null);

  return (
    <TabletNfcClock
      badgeToken={params.badge ?? ""}
      device={device ? {
        id: device.device_id,
        name: device.device_name,
        locationName: device.location.name,
      } : null}
    />
  );
}
