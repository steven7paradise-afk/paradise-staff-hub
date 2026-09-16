"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AutoRefresh({ interval = 300_000 }: { interval?: number }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/appointments" && !pathname.startsWith("/appointments/")) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, Math.max(interval, 300_000));
    return () => window.clearInterval(timer);
  }, [interval, pathname, router]);

  return null;
}
