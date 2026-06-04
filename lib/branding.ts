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
  dark_background_color: string;
  dark_sidebar_color: string;
  dark_card_color: string;
  dark_text_color: string;
  dark_button_color: string;
  sidebar_text_color: string;
  sidebar_icon_color: string;
  dark_sidebar_text_color: string;
  dark_sidebar_icon_color: string;
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
  dark_background_color: "#121114",
  dark_sidebar_color: "#1B1A1F",
  dark_card_color: "#201F24",
  dark_text_color: "#F8F3F6",
  dark_button_color: "#F4A3C4",
  sidebar_text_color: "#1F1F1F",
  sidebar_icon_color: "#1F1F1F",
  dark_sidebar_text_color: "#F8F3F6",
  dark_sidebar_icon_color: "#F8F3F6",
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
    "--light-background": theme.background_color,
    "--light-sidebar": theme.sidebar_color,
    "--light-card": theme.card_color,
    "--light-text": theme.text_color,
    "--light-button": theme.button_color,
    "--background": theme.background_color,
    "--sidebar": theme.sidebar_color,
    "--button": theme.button_color,
    "--card": theme.card_color,
    "--text": theme.text_color,
    "--gradient": theme.gradient_color,
    "--dark-background": theme.dark_background_color,
    "--dark-sidebar": theme.dark_sidebar_color,
    "--dark-card": theme.dark_card_color,
    "--dark-text": theme.dark_text_color,
    "--dark-button": theme.dark_button_color,
    "--sidebar-text": theme.sidebar_text_color,
    "--sidebar-icon": theme.sidebar_icon_color,
    "--dark-sidebar-text": theme.dark_sidebar_text_color,
    "--dark-sidebar-icon": theme.dark_sidebar_icon_color,
  } as CSSProperties;
}
