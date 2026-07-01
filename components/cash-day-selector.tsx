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
      <Calendar className="absolute left-3.5 size-4 text-white/60 pointer-events-none" />
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
        className="h-10 rounded-2xl border border-white/15 bg-white/10 pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-[#B85B68] focus:ring-1 focus:ring-[#B85B68]/30 [color-scheme:dark] transition-colors cursor-pointer hover:bg-white/15"
      />
    </div>
  );
}
