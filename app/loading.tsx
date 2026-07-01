import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 p-4 backdrop-blur-md dark:bg-[#050608]/80">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <Loader2 className="size-10 animate-spin text-[#A74758]" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
          Caricamento...
        </p>
      </div>
    </div>
  );
}
