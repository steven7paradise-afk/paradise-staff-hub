import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paradise Staff Hub",
    short_name: "Paradise Hub",
    description: "App interna Paradise Beauty per staff, tablet clock, turni e documenti.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFA8DD",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/paradise-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
