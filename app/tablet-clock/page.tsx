import type { Metadata } from "next";
import { TabletClock } from "@/components/tablet-clock";
import { cookies, headers } from "next/headers";
import { getBrandingTheme } from "@/lib/branding";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
  const [cookieStore, headerStore, session] = await Promise.all([
    cookies(),
    headers(),
    auth()
  ]);
  const requestedDevice = params.device ?? cookieStore.get(tabletDeviceCookieName)?.value ?? "";
  
  let device = null;
  let branding = null;
  let tabletBranding = null;
  
  try {
    const [dev, brand, tabletSetting] = await Promise.all([
      authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)),
      getBrandingTheme(),
      prisma.setting.findUnique({ where: { key: "tablet_branding" } }),
    ]);
    device = dev;
    branding = brand;
    tabletBranding = tabletSetting ? (tabletSetting.value as any) : null;
  } catch (error) {
    console.error("Error loading tablet page data:", error);
    // Safe fallbacks
    branding = await getBrandingTheme();
  }

  // Controllo permessi del dispositivo e dell'utente
  if (!device) {
    if (session?.user) {
      // Se l'utente è un dipendente o responsabile senza permessi di gestione tablet, mandalo alla dashboard
      if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
        redirect("/dashboard");
      }
    } else {
      // Se non è loggato, mandalo alla pagina di login impostando il callbackUrl
      redirect(`/login?callbackUrl=${encodeURIComponent("/tablet-clock")}`);
    }
  }

  return (
    <TabletClock
      device={device ? {
        id: device.device_id,
        name: device.device_name,
        locationName: device.location.name,
      } : null}
      branding={branding}
      tabletBranding={tabletBranding}
    />
  );
}

