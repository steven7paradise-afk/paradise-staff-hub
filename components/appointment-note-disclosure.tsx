"use client";

import React from "react";

/** Native disclosure: keyboard-accessible and usable before hydration. */
export function AppointmentNoteDisclosure({ text, label }: { text: string; label: string }) {
  return (
    <details
      className="group/note min-w-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary
        aria-label={`${label}: mostra o riduci il testo completo`}
        className="cursor-pointer list-none rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current [&::-webkit-details-marker]:hidden"
      >
        <span className="line-clamp-3 whitespace-pre-wrap [overflow-wrap:anywhere] group-open/note:hidden">{text}</span>
        <span className="mt-1 inline-flex min-h-11 items-center text-xs font-bold underline underline-offset-4">
          <span className="group-open/note:hidden">Leggi tutta la nota</span>
          <span className="hidden group-open/note:inline">Riduci nota</span>
        </span>
      </summary>
      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed [overflow-wrap:anywhere]">{text}</p>
    </details>
  );
}
