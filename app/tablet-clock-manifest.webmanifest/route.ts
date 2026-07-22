import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    name: "Paradise Tablet Clock",
    short_name: "Tablet Clock",
    description: "Timbratrice tablet Paradise Beauty.",
    id: "/tablet-clock",
    start_url: "/tablet-clock",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFA8DD",
    orientation: "landscape",
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
  });
}
