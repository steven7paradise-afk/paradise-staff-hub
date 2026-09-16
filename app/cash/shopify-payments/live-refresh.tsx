"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function ShopifyPaymentsLiveRefresh() {
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


  return null;
}
