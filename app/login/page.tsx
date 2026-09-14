import { BetaLoginExperience } from "@/components/beta-login-experience";
import { getBrandingTheme, brandingCss } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ documentAccessExpired?: string }>;
}) {
  const params = await searchParams;
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
