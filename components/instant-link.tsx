"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type InstantLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  loadingClassName?: string;
  "aria-label"?: string;
};

export function InstantLink({
  href,
  children,
  className,
  activeClassName = "bg-paradise-nude text-paradise-noir",
  loadingClassName = "scale-[0.98] opacity-80 ring-2 ring-paradise-pink/35",
  ...props
}: InstantLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  function warmPage() {
    router.prefetch(href);
  }

  return (
    <Link
      {...props}
      href={href}
      prefetch
      onMouseEnter={warmPage}
      onTouchStart={warmPage}
      onPointerDown={() => setLoading(true)}
      onClick={() => setLoading(true)}
      className={cn(
        "relative transition duration-150 active:scale-[0.98]",
        className,
        isActive && activeClassName,
        loading && !isActive && loadingClassName,
      )}
    >
      {children}
      {loading && !isActive ? (
        <span className="absolute right-3 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#C66170] shadow-[0_0_0_4px_rgba(198,97,112,0.14)]" />
      ) : null}
    </Link>
  );
}
