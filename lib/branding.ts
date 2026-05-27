import { unstable_cache } from "next/cache";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";

export type BrandingTheme = {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  sidebar_color: string;
  button_color: string;
  card_color: string;
  text_color: string;
  gradient_color: string;
  logo_url: string | null;
};

const fallbackBranding: BrandingTheme = {
  primary_color: "#FFA8DD",
  secondary_color: "#FFD6EA",
  background_color: "#F7E9EF",
  sidebar_color: "#FFFFFF",
  button_color: "#FFA8DD",
  card_color: "#FFFFFF",
  text_color: "#1F1F1F",
  gradient_color: "#E8C98B",
  logo_url: null,
};

export const getBrandingTheme = unstable_cache(
  async (): Promise<BrandingTheme> => {
    if (!process.env.DATABASE_URL) return fallbackBranding;
    try {
      const branding = await prisma.brandingSetting.findFirst();
      return branding ?? fallbackBranding;
    } catch {
      return fallbackBranding;
    }
  },
  ["paradise-branding-theme"],
  { revalidate: 300, tags: ["branding"] },
);

export function brandingCss(theme: BrandingTheme) {
  return {
    "--primary": theme.primary_color,
    "--secondary": theme.secondary_color,
    "--background": theme.background_color,
    "--sidebar": theme.sidebar_color,
    "--button": theme.button_color,
    "--card": theme.card_color,
    "--text": theme.text_color,
    "--gradient": theme.gradient_color,
  } as CSSProperties;
}
