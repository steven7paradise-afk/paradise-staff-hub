import type { MetadataRoute } from "next";

function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paradise Staff Hub",
    short_name: "Paradise Hub",
    description: "App interna Paradise Beauty per staff, tablet clock, turni e documenti.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFA8DD",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

export function GET() {
  return Response.json(manifest(), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
