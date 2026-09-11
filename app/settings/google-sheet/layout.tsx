import { AppShell } from "@/components/app-shell";

export default function GoogleSheetSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      title="Google Sheet"
      subtitle="Esportazione automatica e sincronizzazione delle timbrature dei collaboratori."
      role="SUPER_ADMIN"
    >
      {children}
    </AppShell>
  );
}
