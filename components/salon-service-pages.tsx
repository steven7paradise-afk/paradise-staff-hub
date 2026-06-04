"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCircle2, ClipboardList, FilePenLine } from "lucide-react";
import { Badge, Card, Select } from "@/components/ui";
import { InstantLink } from "@/components/instant-link";
import type { Role } from "@/lib/roles";

type LocationOption = { id: string; name: string };
type ServicePageSetting = { locationId: string; page: number };

const pageInfo = {
  1: { title: "NOTE", text: "Note operative", href: "/service-notes", icon: FilePenLine },
  2: { title: "TASK", text: "Task operative", href: "/tasks", icon: CheckCircle2 },
  3: { title: "FORMS", text: "Richieste e moduli", href: "/service-forms", icon: ClipboardList },
};

function normalizePage(page: number | undefined) {
  return page === 2 || page === 3 ? page : 1;
}

export function SalonServicePages({
  role,
  locations,
  currentLocationId,
  initialSettings,
}: {
  role: Role;
  locations: LocationOption[];
  currentLocationId: string | null;
  initialSettings: ServicePageSetting[];
}) {
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN";
  const [settings, setSettings] = useState<Record<string, number>>(
    initialSettings.reduce<Record<string, number>>((accumulator, setting) => {
      accumulator[setting.locationId] = normalizePage(setting.page);
      return accumulator;
    }, {}),
  );
  const activeLocation = locations.find((location) => location.id === currentLocationId) ?? locations[0];
  const activePage = normalizePage(activeLocation ? settings[activeLocation.id] : 1);
  const servicePages = Object.entries(pageInfo).map(([page, info]) => ({ page: Number(page), ...info }));

  async function save(locationId: string, page: number) {
    setSettings((current) => ({ ...current, [locationId]: page }));
    await fetch("/api/settings/service-pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, page }),
    });
  }

  return (
    <div className="mt-6 space-y-5">
      {canManage ? (
        <Card className="bg-white">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Configurazione</p>
              <h2 className="mt-1 text-xl font-semibold">Pagina operativa per salone</h2>
            </div>
            <Badge tone="gold">{locations.length} saloni</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {locations.map((location) => (
              <label key={location.id} className="grid gap-3 rounded-2xl border border-black/5 bg-[#FBF7F9] p-4">
                <span className="text-sm font-semibold leading-5">{location.name}</span>
                <Select value={normalizePage(settings[location.id])} onChange={(event) => save(location.id, Number(event.target.value))}>
                  <option value={1}>NOTE</option>
                  <option value={2}>TASK</option>
                  <option value={3}>FORMS</option>
                </Select>
              </label>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {servicePages.map((page) => {
          const Icon = page.icon;
          const selected = page.page === activePage;
          return (
            <InstantLink
              key={page.page}
              href={page.href}
              className={`group min-h-32 rounded-[22px] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                selected ? "border-[#C66170]/25 bg-white shadow-sm" : "border-black/5 bg-white/70"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className={selected ? "grid size-12 place-items-center rounded-2xl bg-paradise-softPink text-[#A74758]" : "grid size-12 place-items-center rounded-2xl bg-black/5 text-black/55"}>
                  <Icon className="size-5" />
                </div>
                <ArrowUpRight className="size-4 text-black/30 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-black/70" />
              </div>
              <div className="mt-5">
                <p className="text-lg font-semibold tracking-tight">{page.title}</p>
                <p className="mt-1 text-sm text-black/50">{page.text}</p>
                {selected ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#A74758]">{activeLocation?.name ?? "Salone"}</p> : null}
              </div>
            </InstantLink>
          );
        })}
      </div>
    </div>
  );
}
