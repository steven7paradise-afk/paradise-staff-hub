"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, Loader2, KeyRound, Mail } from "lucide-react";
import { Button, Field } from "@/components/ui";

export function LoginForm() {
  const [loginMode, setLoginMode] = useState<"email" | "pin">("pin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const callbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") ?? "/dashboard";

    let result;
    if (loginMode === "pin") {
      result = await signIn("credentials", {
        pin,
        redirect: false,
        callbackUrl,
      });
    } else {
      result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
    }

    setLoading(false);

    if (result?.error) {
      setError(loginMode === "pin" ? "PIN personale non corretto." : "Email o password non corretti.");
      return;
    }

    router.prefetch(result?.url ?? callbackUrl);
    router.replace(result?.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl bg-paradise-nude/45 p-1 border border-black/5 dark:border-white/5">
        <button
          type="button"
          onClick={() => { setLoginMode("pin"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
            loginMode === "pin"
              ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white"
              : "text-black/55 hover:text-black dark:text-white/60 dark:hover:text-white"
          }`}
        >
          <KeyRound className="size-3.5" />
          Accedi con PIN
        </button>
        <button
          type="button"
          onClick={() => { setLoginMode("email"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
            loginMode === "email"
              ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white"
              : "text-black/55 hover:text-black dark:text-white/60 dark:hover:text-white"
          }`}
        >
          <Mail className="size-3.5" />
          Accedi con Email
        </button>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        {loginMode === "pin" ? (
          <Field
            name="pin"
            type="password"
            placeholder="Inserisci il tuo PIN (es. 123456)"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="current-password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        ) : (
          <>
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
          </>
        )}

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
        <p className="text-center text-[10px] text-black/45 dark:text-white/40">
          {loginMode === "pin"
            ? "Usa lo stesso PIN personale che usi sul tablet per timbrare."
            : "Inserisci la tua email completa e la password personale."}
        </p>
      </form>
    </div>
  );
}
