"use client";

import { useId } from "react";
import { Camera, ShoppingBag, Star, ClipboardCheck } from "lucide-react";

const checks = [
  { key: "beforeMedia", label: "Prima foto/video", icon: Camera },
  { key: "afterMedia", label: "Dopo foto/video", icon: Camera },
  { key: "products", label: "Prodotti", icon: ShoppingBag },
  { key: "review", label: "Recensione", icon: Star },
] as const;
export type ClientControlCheckKey = typeof checks[number]["key"];

type Props = {
  values: Record<ClientControlCheckKey, boolean>;
  disabled?: boolean;
  onChange: (key: ClientControlCheckKey, checked: boolean) => void;
};

export function ClientControlChecks({ values, disabled, onChange }: Props) {
  const id = useId();
  return <section aria-labelledby={`${id}-heading`} className="rounded-[22px] border-2 border-[#D9A1BA] bg-[#FFF6FA] p-4 shadow-[0_6px_24px_rgba(129,55,88,0.08)] sm:p-5">
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#813758] text-base font-bold text-white"><ClipboardCheck className="size-5" /></span>
      <div>
        <h3 id={`${id}-heading`} className="text-lg font-bold text-[#54213A]">Verifiche e controlli</h3>
        <p id={`${id}-hint`} className="mt-1 text-sm text-[#674454]">Prima di completare la scheda, indica le attività che hai svolto.</p>
      </div>
    </div>
    <fieldset disabled={disabled} aria-describedby={`${id}-hint ${id}-bonus`} className="mt-4 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 disabled:opacity-60">
      <legend className="sr-only">Attività svolte per questa cliente</legend>
      {checks.map(({ key, label, icon: Icon }) => <label key={key} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-[#813758] focus-within:ring-offset-2 ${values[key] ? "border-[#813758] bg-[#813758] text-white" : "border-[#E7C7D5] bg-white text-[#54213A] hover:border-[#AD6285]"}`}>
        <input type="checkbox" checked={values[key]} onChange={event => onChange(key, event.target.checked)} className="size-5 shrink-0 accent-[#813758]" />
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span>{label}</span>
      </label>)}
    </fieldset>
    <p id={`${id}-bonus`} className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#813758]"><Star aria-hidden="true" className="size-4 shrink-0" />Questi controlli contano per il vostro bonus.</p>
  </section>;
}
