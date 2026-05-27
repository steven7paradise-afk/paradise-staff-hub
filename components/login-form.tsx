"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Field } from "@/components/ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    window.location.href = result?.url ?? callbackUrl;
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
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Accesso in corso..." : "Entra nel pannello"}
      </Button>
      <p className="text-center text-xs text-black/45">
        Inserisci la tua email completa e la password personale, non il PIN tablet.
      </p>
    </form>
  );
}
