"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

export function CashDaySelector({
  selectedDay,
  month,
}: {
  selectedDay: string;
  month: string;
}) {
  const router = useRouter();

  return (
    <div className="relative inline-flex items-center">
      <Calendar className="pointer-events-none absolute left-3.5 size-4 text-[#A74758]" />
      <input
        type="date"
        value={selectedDay}
        onChange={(e) => {
          if (e.target.value) {
            const dateParts = e.target.value.split("-");
            const newMonth = `${dateParts[0]}-${dateParts[1]}`;
            router.push(`/cash?month=${newMonth}&day=${e.target.value}`);
          }
        }}
        aria-label="Seleziona il giorno da controllare"
        className="h-11 w-full cursor-pointer rounded-md border border-black/10 bg-white pl-10 pr-3 text-xs font-bold text-[#111017] outline-none transition-colors [color-scheme:light] hover:border-black/20 focus:border-[#A74758] focus:ring-2 focus:ring-[#A74758]/10 sm:w-auto"
      />
    </div>
  );
}
