"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ShopifyPaymentsLiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>(".luxury-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [routeKey]);

  useEffect(() => {
    let lastRefreshAt = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt < 5 * 60_000) return;
      lastRefreshAt = now;
      router.refresh();
    };
    const timer = window.setInterval(refresh, 5 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
