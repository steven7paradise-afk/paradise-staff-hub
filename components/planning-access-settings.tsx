"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, Search, ShieldCheck } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import type { PlanningAccess } from "@/lib/planning-access";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type UserOption = {
  id: string;
  name: string;
  role: Role;
  mansione: string | null;
  sede: string | null;
};

const roleOptions: { value: Role; label: string }[] = [
  { value: "RESPONSABILE", label: "Responsabili" },
  { value: "DIPENDENTE", label: "Tutti dipendenti" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export function PlanningAccessSettings({
  initialAccess,
  users,
}: {
  initialAccess: PlanningAccess;
  users: UserOption[];
}) {
  const [access, setAccess] = useState(initialAccess);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Salvato");
  const [isPending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => `${user.name} ${user.mansione ?? ""} ${user.sede ?? ""}`.toLowerCase().includes(term));
  }, [query, users]);

  function save(next: PlanningAccess) {
    setAccess(next);
    setStatus("Salvataggio...");
    startTransition(async () => {
      try {
        const response = await fetch("/api/settings/planning-access", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error("Errore");
        setStatus("Salvato");
      } catch {
        setStatus("Errore salvataggio");
      }
    });
  }

  function toggleRole(role: Role) {
    const roles = access.roles.includes(role)
      ? access.roles.filter((item) => item !== role)
      : [...access.roles, role];
    save({ ...access, roles });
  }

  function toggleUser(userId: string) {
    const userIds = access.userIds.includes(userId)
      ? access.userIds.filter((item) => item !== userId)
      : [...access.userIds, userId];
    save({ ...access, userIds });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="rounded-[22px] p-5 hover:translate-y-0">
        <div className="flex items-start gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-paradise-pink/20 text-[#B85B68]">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#B85B68]">Permessi Planning</p>
            <h2 className="mt-2 text-2xl font-black">Vista sola lettura</h2>
            <p className="mt-2 text-sm leading-6 text-black/55 dark:text-white/55">
              Scegli chi può vedere la turnistica senza poter applicare modifiche, cambiare celle o creare categorie.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Ruoli abilitati</p>
          <div className="grid gap-2">
            {roleOptions.map((role) => {
              const selected = access.roles.includes(role.value);
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition",
                    selected
                      ? "border-paradise-pink/45 bg-paradise-pink/15 text-[#B85B68]"
                      : "border-black/5 bg-white/70 text-black/60 hover:bg-paradise-nude dark:border-white/10 dark:bg-white/5 dark:text-white/65"
                  )}
                >
                  {role.label}
                  {selected ? <Check className="size-4" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-5 rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-semibold text-black/45 dark:bg-white/5 dark:text-white/45">
          Stato: {isPending ? "Salvataggio..." : status}
        </p>
      </Card>

      <Card className="rounded-[22px] p-0 hover:translate-y-0">
        <div className="border-b border-black/5 p-5 dark:border-white/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Collaboratori specifici</p>
              <h2 className="mt-2 text-2xl font-black">Permessi personali</h2>
            </div>
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/35" />
              <Field className="pl-10" placeholder="Cerca nome, mansione, salone..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
        </div>

        <div className="max-h-[680px] overflow-auto p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredUsers.map((user) => {
              const selected = access.userIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className={cn(
                    "min-h-24 rounded-2xl border p-4 text-left transition",
                    selected
                      ? "border-[#B85B68] bg-paradise-softPink/45 shadow-sm"
                      : "border-black/5 bg-white/80 hover:bg-paradise-nude dark:border-white/10 dark:bg-white/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black">{user.name}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-black/45 dark:text-white/45">{user.mansione || "Collaboratore"}</p>
                      <p className="mt-1 truncate text-xs text-black/35 dark:text-white/35">{user.sede || "Sede non assegnata"}</p>
                    </div>
                    <span className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full border",
                      selected ? "border-[#B85B68] bg-[#B85B68] text-white" : "border-black/10 text-black/25 dark:border-white/15 dark:text-white/25"
                    )}>
                      {selected ? <Check className="size-4" /> : <ShieldCheck className="size-4" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
