import { AppShell } from "@/components/app-shell";
import { BrandingForm } from "@/components/branding-form";
import { getBrandingTheme } from "@/lib/branding";

export default async function BrandingSettingsPage() {
  const branding = await getBrandingTheme();
  return (
    <AppShell title="Branding" subtitle="Modifica colori del sito, bottoni, card, sidebar e logo ufficiale.">
      <BrandingForm initial={branding} />
    </AppShell>
  );
}
