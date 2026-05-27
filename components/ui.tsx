import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[20px] border border-black/5 bg-[color:var(--card)] p-6 shadow-sm",
        "dark:border-white/10",
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
    primary: "bg-[color:var(--button)] text-paradise-noir hover:brightness-95",
    soft: "bg-white text-paradise-noir ring-1 ring-black/5 hover:bg-paradise-nude",
    dark: "bg-paradise-noir text-white hover:bg-black",
  };

  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm transition",
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
    pink: "bg-paradise-softPink text-paradise-noir",
    gold: "bg-paradise-gold/30 text-paradise-noir",
    green: "bg-emerald-100 text-emerald-800",
    dark: "bg-paradise-noir text-white",
  };

  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
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
