import { AppInstallPanel } from "@/components/app-install-panel";
import { AppShell } from "@/components/app-shell";

export default function AppSettingsPage() {
  return (
    <AppShell title="App Android" subtitle="Installa Paradise Staff Hub sui tablet o scarica il file APK ufficiale.">
      <AppInstallPanel apkUrl={process.env.NEXT_PUBLIC_ANDROID_APK_URL} />
    </AppShell>
  );
}
