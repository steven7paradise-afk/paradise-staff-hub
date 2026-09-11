import { CalendarDays } from "lucide-react";

export default function ConsulenzaOnlineLoading() {
  return (
    <div className="space-y-5 p-3 sm:p-5 lg:p-7">
      <div className="animate-pulse rounded-[30px] border border-white/80 bg-white/70 p-6 shadow-sm lg:p-8">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-black/[0.06] text-black/20">
            <CalendarDays className="size-6" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-28 rounded-full bg-black/[0.06]" />
            <div className="h-8 w-64 max-w-full rounded-xl bg-black/[0.07]" />
            <div className="h-3 w-80 max-w-full rounded-full bg-black/[0.05]" />
          </div>
        </div>
      </div>

      <div className="grid animate-pulse gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-h-[680px] rounded-[28px] border border-black/[0.04] bg-white/75 p-6 shadow-sm">
          <div className="h-12 rounded-2xl bg-black/[0.045]" />
          <div className="mt-6 grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, index) => (
              <div key={index} className="h-28 rounded-xl bg-black/[0.035]" />
            ))}
          </div>
        </div>
        <div className="min-h-[480px] rounded-[28px] border border-black/[0.04] bg-white/75 shadow-sm" />
      </div>
    </div>
  );
}
