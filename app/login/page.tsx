import { Crown } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-paradise-noir text-white">
            <Crown className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Paradise Staff Hub</h1>
            <p className="text-sm text-black/50">Accesso riservato al team Paradise Beauty</p>
          </div>
        </div>
        <LoginForm />
        <p className="mt-5 text-center text-xs text-black/45">
          Credenziali, ruoli e permessi sono gestiti via database Neon e NextAuth.
        </p>
      </Card>
    </main>
  );
}
