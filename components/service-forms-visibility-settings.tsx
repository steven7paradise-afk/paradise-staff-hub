"use client";

import { useState, useTransition } from "react";
import { Check, EyeOff } from "lucide-react";
import { Card } from "@/components/ui";
import type { ServiceFormsVisibility } from "@/lib/service-form-visibility";
import { cn } from "@/lib/utils";

type FormOption = {
  id: string;
  name: string;
  category: string;
  active: boolean;
};

export function ServiceFormsVisibilitySettings({
  forms,
  initialVisibility,
}: {
  forms: FormOption[];
  initialVisibility: ServiceFormsVisibility;
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [status, setStatus] = useState("Salvato");
  const [isPending, startTransition] = useTransition();

  function save(next: ServiceFormsVisibility) {
    setVisibility(next);
    setStatus("Salvataggio...");
    startTransition(async () => {
      try {
        const response = await fetch("/api/settings/service-forms-visibility", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error("Errore");
        setStatus("Salvato");
      } catch {
        setStatus("Errore salvataggio");
      }
    });
  }

  function toggle(formId: string) {
    const hideWhenOffShiftFormIds = visibility.hideWhenOffShiftFormIds.includes(formId)
      ? visibility.hideWhenOffShiftFormIds.filter((id) => id !== formId)
      : [...visibility.hideWhenOffShiftFormIds, formId];
    save({ hideWhenOffShiftFormIds });
  }

  return (
    <Card className="mb-6 rounded-[24px] p-5 hover:translate-y-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paradise-softPink text-[#B85B68]">
            <EyeOff className="size-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#B85B68]">Fuori turno</p>
            <h2 className="mt-1 text-2xl font-black">Moduli da nascondere</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/55">
              Quando un collaboratore non ha una timbratura aperta, questi moduli non saranno visibili nella pagina Cassa.
              Admin, Super Admin e Responsabili continuano a vederli.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-black/[0.04] px-4 py-2 text-xs font-bold text-black/50 dark:bg-white/10 dark:text-white/60">
          {isPending ? "Salvataggio..." : status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {forms.map((form) => {
          const selected = visibility.hideWhenOffShiftFormIds.includes(form.id);
          return (
            <button
              key={form.id}
              type="button"
              onClick={() => toggle(form.id)}
              className={cn(
                "flex min-h-20 items-center justify-between rounded-2xl border p-4 text-left transition",
                selected
                  ? "border-[#B85B68] bg-paradise-softPink/55 text-[#7F3341]"
                  : "border-black/5 bg-white/80 hover:bg-paradise-nude dark:border-white/10 dark:bg-white/5"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-black">{form.name}</span>
                <span className="mt-1 block truncate text-xs font-semibold text-black/40 dark:text-white/40">
                  {form.category || "Generale"} {form.active ? "" : "- disattivo"}
                </span>
              </span>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border",
                  selected ? "border-[#B85B68] bg-[#B85B68] text-white" : "border-black/10 text-black/25"
                )}
              >
                {selected ? <Check className="size-4" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
