import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[24px] border border-black/5 bg-[color:var(--card)]/95 p-6 shadow-sm backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-luxury hover:border-black/10 dark:bg-[color:var(--card)]/80 dark:border-white/10 dark:hover:border-white/20",
        className,
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "dark" }) {
  const variants = {
    primary: "bg-[color:var(--button)] text-paradise-noir hover:brightness-105 hover:shadow-[0_0_20px_rgba(255,168,221,0.45)] dark:hover:shadow-[0_0_20px_rgba(244,163,196,0.3)]",
    soft: "bg-white text-paradise-noir ring-1 ring-black/5 hover:bg-paradise-nude hover:shadow-sm dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/15",
    dark: "bg-paradise-noir text-white hover:bg-black/90 hover:shadow-sm dark:bg-white dark:text-paradise-noir dark:hover:bg-white/95",
  };

  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 ease-out active:scale-[0.96] active:brightness-95 hover:scale-[1.01]",
        "focus:outline-none focus:ring-2 focus:ring-paradise-pink/60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, tone = "pink" }: { children: React.ReactNode; tone?: "pink" | "gold" | "green" | "dark" }) {
  const tones = {
    pink: "bg-paradise-softPink/50 border border-paradise-pink/35 text-[#B85B68] dark:text-[#F4A3C4]",
    gold: "bg-paradise-gold/15 border border-paradise-gold/30 text-[#9E7A3B] dark:text-paradise-gold",
    green: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    dark: "bg-paradise-noir/80 border border-white/10 text-white",
  };

  return <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02]", tones[tone])}>{children}</span>;
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="min-h-12 w-full rounded-2xl border border-black/10 bg-white/80 px-4 text-sm outline-none transition placeholder:text-black/35 focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20 dark:bg-white/10 dark:text-white"
      {...props}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="min-h-12 w-full rounded-2xl border border-black/10 bg-white/80 px-4 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20 dark:bg-white/10 dark:text-white"
      {...props}
    />
  );
}
