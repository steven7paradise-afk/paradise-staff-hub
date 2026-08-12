"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function GlobalFullscreenLayer({
  children,
  className,
  lockPageScroll = true,
}: {
  children: ReactNode;
  className?: string;
  lockPageScroll?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || !lockPageScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockPageScroll, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className={cn("global-fullscreen-layer fixed inset-0 z-[1000] isolate h-dvh w-screen", className)}>
      {children}
    </div>,
    document.body,
  );
}

