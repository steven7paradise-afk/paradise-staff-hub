import { BetaLoginExperience } from "@/components/beta-login-experience";
import { getBrandingTheme, brandingCss } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ documentAccessExpired?: string; preview?: string }>;
}) {
  const params = await searchParams;
  if (process.env.NODE_ENV === "development" && params.preview === "dashboard") {
    const { DashboardRedesignClient } = await import("@/components/dashboard-redesign-client");
    return <DashboardRedesignClient currentUser={{ id: "demo", name: "Giulia · Esempio", locationName: "Salone di esempio" }} workerGoal={5} currentWorkerPoints={3} professionalLevel="Junior" monthlyDelays={{ entryMinutes: 65, breakMinutes: 20, totalMinutes: 85 }} assignedAppointments={[
      { id: "demo-1", client: "Cliente di esempio", service: "Colore e piega", start: "2026-10-01T14:00:00+02:00", noteCompleted: false },
      { id: "demo-2", client: "Cliente completata di esempio", service: "Taglio", start: "2026-10-01T10:00:00+02:00", noteCompleted: true },
    ]} />;
  }
  if (process.env.NODE_ENV === "development" && params.preview === "services") {
    const { DevWorkerServicesPreview } = await import("@/components/dev-worker-services-preview");
    return <DevWorkerServicesPreview />;
  }
  if (process.env.NODE_ENV === "development" && params.preview === "office-staff") {
    const { DevOfficeWorkerPreview } = await import("@/components/dev-office-worker-preview");
    return <DevOfficeWorkerPreview />;
  }
  const documentAccessExpired = params.documentAccessExpired === "1";
  const branding = await getBrandingTheme();
  const themeStyles = brandingCss(branding);
  const logoSrc = branding.logo_url ?? "/logo.png";

  return (
    <main
      className="paradise-theme-root min-h-[100svh] bg-[#d98fa6]"
      style={themeStyles}
    >
      <BetaLoginExperience
        logoSrc={logoSrc}
        documentAccessExpired={documentAccessExpired}
      />
    </main>
  );
}
