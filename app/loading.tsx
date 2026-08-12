import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-4 py-3 shadow-[0_14px_38px_rgba(32,20,27,0.16)] backdrop-blur-xl dark:border-white/15 dark:bg-[#201D25]/90 sm:right-6 sm:top-6"
      role="status"
      aria-live="polite"
      aria-label="Caricamento della pagina"
    >
      <Loader2 className="size-4 animate-spin text-[#A74758]" />
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/60 dark:text-white/70">
        Aggiornamento...
      </p>
    </div>
  );
}
