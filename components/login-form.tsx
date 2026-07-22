"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { AlertCircle, Loader2, KeyRound, Mail } from "lucide-react";
import { Button, Field } from "@/components/ui";

const DEFAULT_LOGIN_DESTINATION = "/dashboard";

function normalizeLoginDestination(value?: string | null, fallback = DEFAULT_LOGIN_DESTINATION) {
  if (!value) return fallback;

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const isCurrentOrigin = typeof window !== "undefined" && parsed.origin === window.location.origin;
    const isLocalhostRedirect = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);

    if (isCurrentOrigin || isLocalhostRedirect) {
      const destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return destination.startsWith("/") ? destination : fallback;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function LoginForm() {
  const [loginMode, setLoginMode] = useState<"email" | "pin">("pin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setError("");
    setLoading(true);

    try {
      const callbackUrl = normalizeLoginDestination(
        new URLSearchParams(window.location.search).get("callbackUrl"),
      );

      await signOut({ redirect: false });

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

      if (result?.error) {
        submittingRef.current = false;
        setLoading(false);
        setError(loginMode === "pin" ? "PIN personale non corretto." : "Email o password non corretti.");
        return;
      }

      const destination = normalizeLoginDestination(result?.url, callbackUrl);
      router.prefetch(destination);
      window.location.replace(destination);
    } catch {
      submittingRef.current = false;
      setLoading(false);
      setError("Accesso non completato. Controlla la connessione e riprova.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-black/40 dark:text-white/40">
          Metodo di accesso
        </p>
        <p className="text-sm leading-relaxed text-black/55 dark:text-white/55">
          Scegli accesso rapido con PIN oppure login classico con email e password.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-black/5 bg-[#FFF4F8] p-1.5 dark:border-white/5 dark:bg-white/5">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoginMode("pin");
            setError("");
          }}
          className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-bold transition ${
            loginMode === "pin"
              ? "bg-white text-black shadow-[0_10px_30px_rgba(17,17,17,0.08)] dark:bg-neutral-800 dark:text-white"
              : "text-black/55 hover:bg-white/70 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          } disabled:pointer-events-none disabled:opacity-50`}
        >
          <KeyRound className="size-4" />
          PIN
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoginMode("email");
            setError("");
          }}
          className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-bold transition ${
            loginMode === "email"
              ? "bg-white text-black shadow-[0_10px_30px_rgba(17,17,17,0.08)] dark:bg-neutral-800 dark:text-white"
              : "text-black/55 hover:bg-white/70 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          } disabled:pointer-events-none disabled:opacity-50`}
        >
          <Mail className="size-4" />
          Email
        </button>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        {loginMode === "pin" ? (
          <div className="space-y-2">
            <label
              htmlFor="login-pin"
              className="block text-[11px] font-bold uppercase tracking-[0.22em] text-black/45 dark:text-white/45"
            >
              PIN personale
            </label>
            <Field
              id="login-pin"
              name="pin"
              type="password"
              placeholder="Inserisci il tuo PIN a 6 cifre"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={loading}
              required
            />
            <p className="text-xs leading-relaxed text-black/45 dark:text-white/45">
              Usa lo stesso PIN che utilizzi sul tablet per timbrare.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="block text-[11px] font-bold uppercase tracking-[0.22em] text-black/45 dark:text-white/45"
              >
                Email
              </label>
              <Field
                id="login-email"
                name="email"
                type="email"
                placeholder="email@paradisebeauty.it"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmail((current) => current.trim().toLowerCase())}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="login-password"
                className="block text-[11px] font-bold uppercase tracking-[0.22em] text-black/45 dark:text-white/45"
              >
                Password
              </label>
              <Field
                id="login-password"
                name="password"
                type="password"
                placeholder="Inserisci la tua password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>

            <p className="text-xs leading-relaxed text-black/45 dark:text-white/45">
              Inserisci la tua email completa e la password personale.
            </p>
          </>
        )}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 animate-pulse-danger flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 animate-bounce" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button
          className="w-full rounded-[18px] py-3 text-sm font-bold transition active:scale-[0.97] disabled:pointer-events-none disabled:cursor-wait disabled:opacity-70"
          type="submit"
          disabled={loading}
          aria-busy={loading}
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
      </form>
    </div>
  );
}
