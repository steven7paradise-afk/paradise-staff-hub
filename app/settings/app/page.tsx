import { AppInstallPanel } from "@/components/app-install-panel";
import { AppShell } from "@/components/app-shell";
import { TabletBrandingForm } from "@/components/tablet-branding-form";
import { prisma } from "@/lib/prisma";
import type { TabletBranding } from "@/components/tablet-branding-form";

export const dynamic = "force-dynamic";

export default async function AppSettingsPage() {
  let tabletBranding = null;
  if (process.env.DATABASE_URL) {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: "tablet_branding" },
      });
      tabletBranding = setting ? (setting.value as TabletBranding) : null;
    } catch (e) {
      console.error("Error loading tablet branding:", e);
    }
  }

  return (
    <AppShell title="App Android & Tablet" subtitle="Configura l'installazione su tablet e personalizza i colori del Tablet Clock.">
      <div className="flex flex-col gap-8">
        <AppInstallPanel apkUrl={process.env.NEXT_PUBLIC_ANDROID_APK_URL} />
        <TabletBrandingForm initial={tabletBranding} />
      </div>
    </AppShell>
  );
}

