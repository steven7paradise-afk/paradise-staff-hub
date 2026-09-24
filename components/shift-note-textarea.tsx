"use client";

import { useId, type TextareaHTMLAttributes } from "react";
import { SHIFT_NOTE_LIMIT } from "@/lib/shift-note-limits";

export function ShiftNoteTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const counterId = useId();
  const length = String(props.value ?? "").length;
  return <div className="min-w-0">
    <textarea {...props} maxLength={SHIFT_NOTE_LIMIT} aria-describedby={[props["aria-describedby"], counterId].filter(Boolean).join(" ")} />
    <p id={counterId} className="mt-1 text-right text-xs text-slate-600">
      {length.toLocaleString("it-IT")} / 5.000 caratteri{length >= SHIFT_NOTE_LIMIT ? " · Limite raggiunto" : ""}
    </p>
  </div>;
}
