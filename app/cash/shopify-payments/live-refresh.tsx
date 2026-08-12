"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ShopifyPaymentsLiveRefresh() {
  const router = useRouter();

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
