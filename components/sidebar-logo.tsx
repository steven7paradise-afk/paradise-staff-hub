"use client";

import { useEffect, useState } from "react";

export function SidebarLogo({ url, color }: { url: string | null; color?: string | null }) {
  const [logo, setLogo] = useState({ url, color });
  useEffect(() => { setLogo({ url, color }); }, [url, color]);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) setLogo({ url: detail.logo_url, color: detail.logo_color });
    };
    window.addEventListener("branding-change", update);
    return () => window.removeEventListener("branding-change", update);
  }, []);
  const src = logo.url || "/logo.png";
  return logo.color ? (
    <span role="img" aria-label="Paradise Beauty" className="block h-12 w-full" style={{
      backgroundColor: logo.color,
      maskImage: `url(${JSON.stringify(src)})`, WebkitMaskImage: `url(${JSON.stringify(src)})`,
      maskSize: "contain", WebkitMaskSize: "contain",
      maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
      maskPosition: "left center", WebkitMaskPosition: "left center",
    }} />
  ) : <img src={src} alt="Paradise Beauty" className="max-h-12 w-full object-contain object-left select-none pointer-events-none" />;
}
