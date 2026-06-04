"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, Field } from "@/components/ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const callbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") ?? "/dashboard";

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email o password non corretti.");
      return;
    }

    router.prefetch(result?.url ?? callbackUrl);
    router.replace(result?.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field
        name="email"
        type="email"
        placeholder="email@paradisebeauty.it"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => setEmail((current) => current.trim().toLowerCase())}
        required
      />
      <Field
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 animate-pulse-danger flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 animate-bounce" />
          <span>{error}</span>
        </div>
      ) : null}
      <Button 
        className="w-full transition active:scale-[0.97]" 
        type="submit" 
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Accesso in corso...
          </span>
        ) : (
          "Entra nel pannello"
        )}
      </Button>
      <p className="text-center text-xs text-black/45 dark:text-white/40">
        Inserisci la tua email completa e la password personale, non il PIN tablet.
      </p>
    </form>
  );
}
