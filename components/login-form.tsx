"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { AlertCircle, Loader2 } from "lucide-react";
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

type LoginFormVariant = "default" | "mobile-overlay";

export function LoginForm({ variant = "default", documentAccessExpired = false }: { variant?: LoginFormVariant; documentAccessExpired?: boolean }) {
  const [loginMode, setLoginMode] = useState<"email" | "pin">("email");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const isMobileOverlay = variant === "mobile-overlay";

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

      const result = await signIn("credentials", {
        ...(loginMode === "pin" ? { pin } : { email, password }), redirect: false, callbackUrl,
      });

      if (result?.error) {
        if (result.error !== "CredentialsSignin") {
          submittingRef.current = false;
          setLoading(false);
          setError("Servizio di accesso temporaneamente non disponibile. Riprova tra poco.");
          return;
        }
        const accessStatus = await fetch("/api/auth/document-access-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginMode === "pin" ? { pin } : { email, password }),
        }).then((response) => {
          if (!response.ok) throw new Error("Verifica accesso non disponibile");
          return response.json();
        }).catch(() => ({ unavailable: true }));
        submittingRef.current = false;
        setLoading(false);
        setError(accessStatus.unavailable
          ? "Impossibile verificare l’accesso in questo momento. Riprova tra poco."
          : accessStatus.expired
          ? "L’accesso è stato disattivato. Per richiedere i tuoi documenti scrivi a amministrazione@paradisebeauty.it."
          : loginMode === "pin" ? "PIN personale non corretto." : "Email o password non corretti.");
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
    <div className={isMobileOverlay ? "space-y-4" : "space-y-5"}>
      {documentAccessExpired ? (
        <div className={isMobileOverlay
          ? "rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-left text-sm font-bold text-white"
          : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"}
        >
          L’accesso è stato disattivato. Per richiedere i tuoi documenti scrivi a amministrazione@paradisebeauty.it.
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2" aria-label="Metodo di accesso">
        {(["email", "pin"] as const).map((method) => (
          <button key={method} type="button" aria-pressed={loginMode === method} disabled={loading}
            onClick={() => { setLoginMode(method); setError(""); }}
            className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${loginMode === method ? "border-pink-300 bg-pink-100 text-black" : isMobileOverlay ? "border-white/30 text-white" : "border-black/15 text-black dark:text-white"}`}>
            {method === "email" ? "Email e password" : "PIN personale"}
          </button>
        ))}
      </div>
      <form className="space-y-4" onSubmit={submit}>
        {loginMode === "pin" ? (
          <div className="space-y-2">
            <label htmlFor="login-pin" className="block text-sm font-semibold">PIN personale</label>
            <Field id="login-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6}
              autoComplete="current-password" placeholder="Inserisci il tuo PIN" required disabled={loading} value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className={isMobileOverlay ? "border-white/30 bg-white/10 text-base text-white" : "border-black/20 bg-white text-base text-black"} />
          </div>
        ) : (<>
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className={`block text-sm font-semibold ${
                  isMobileOverlay ? "text-white/90" : "text-black/75 dark:text-white/85"
                }`}
              >
                Email
              </label>
              <Field
                id="login-email"
                name="email"
                type="email"
                placeholder="nome@esempio.it"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmail((current) => current.trim().toLowerCase())}
                disabled={loading}
                required
                className={
                  isMobileOverlay
                    ? "border-white/30 bg-white/10 text-base text-white placeholder:text-white/60"
                    : "border-black/20 bg-white text-base text-black placeholder:text-black/45"
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="login-password"
                className={`block text-sm font-semibold ${
                  isMobileOverlay ? "text-white/90" : "text-black/75 dark:text-white/85"
                }`}
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
                className={
                  isMobileOverlay
                    ? "border-white/30 bg-white/10 text-base text-white placeholder:text-white/60"
                    : "border-black/20 bg-white text-base text-black placeholder:text-black/45"
                }
              />
            </div>

            <p className={`text-xs leading-relaxed ${isMobileOverlay ? "text-white/65" : "text-black/45 dark:text-white/45"}`}>
              Inserisci la tua email completa e la password personale.
            </p>
          </>)}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 animate-pulse-danger flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 animate-bounce" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button
          className={`w-full py-3 text-sm font-bold transition active:scale-[0.97] disabled:pointer-events-none disabled:cursor-wait disabled:opacity-70 ${
            isMobileOverlay
              ? "rounded-2xl bg-white text-black hover:bg-white/90"
              : "rounded-[18px]"
          }`}
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
