"use client";

import { Printer } from "lucide-react";

export function ShippingPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#181818] px-4 py-2 text-sm font-medium text-white hover:bg-[#333] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]"
    >
      <Printer className="size-4" aria-hidden="true" /> Stampa
    </button>
  );
}
