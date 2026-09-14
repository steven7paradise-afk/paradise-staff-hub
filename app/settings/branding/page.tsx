import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BrandingForm } from "@/components/branding-form";
import { auth } from "@/lib/auth";
import { getBrandingTheme } from "@/lib/branding";

export default async function BrandingSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "ZERO") {
    redirect("/dashboard");
  }

  const branding = await getBrandingTheme();
  return (
    <AppShell title="Branding" subtitle="Personalizza colori, sidebar e logo della beta." hideHeader transparentMain edgeToEdgeMain>
      <BrandingForm initial={branding} />
    </AppShell>
  );
}
