"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCircle2, ClipboardList, FilePenLine } from "lucide-react";
import { Badge, Card, Select } from "@/components/ui";
import { InstantLink } from "@/components/instant-link";
import type { Role } from "@/lib/roles";

type LocationOption = { id: string; name: string };
type ServicePageSetting = { locationId: string; page: number; customName?: string; customIcon?: string };

const availableIcons = [
  { value: "FilePenLine", label: "Penna (Note)" },
  { value: "CheckSquare", label: "Check (Task)" },
  { value: "ClipboardList", label: "Clipboard (Form)" },
  { value: "CalendarDays", label: "Calendario" },
  { value: "Users", label: "Utenti/Team" },
  { value: "Building2", label: "Salone" },
  { value: "Smartphone", label: "Tablet" },
  { value: "ShieldCheck", label: "Ferie/Richieste" },
  { value: "FileText", label: "Documenti" },
  { value: "Calculator", label: "Calcolatrice" },
  { value: "LayoutDashboard", label: "Dashboard" },
  { value: "Settings", label: "Ingranaggio" },
  { value: "Bell", label: "Campanella" },
  { value: "Mail", label: "Busta" },
  { value: "Palette", label: "Tavolozza" },
  { value: "Star", label: "Stella" },
  { value: "Coffee", label: "Caffè" },
  { value: "ShoppingBag", label: "Busta spesa" },
  { value: "Utensils", label: "Posate" },
  { value: "Package", label: "Pacco" },
  { value: "Folder", label: "Cartella" },
];

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
  const [settings, setSettings] = useState<Record<string, { page: number; customName: string; customIcon: string }>>(
    initialSettings.reduce<Record<string, { page: number; customName: string; customIcon: string }>>((accumulator, setting) => {
      accumulator[setting.locationId] = {
        page: normalizePage(setting.page),
        customName: setting.customName || "",
        customIcon: setting.customIcon || "",
      };
      return accumulator;
    }, {}),
  );
  const activeLocation = locations.find((location) => location.id === currentLocationId) ?? locations[0];
  const activePage = normalizePage(activeLocation ? settings[activeLocation.id]?.page : 1);
  const servicePages = Object.entries(pageInfo).map(([page, info]) => ({ page: Number(page), ...info }));

  async function save(locationId: string, page: number, customName: string, customIcon: string) {
    setSettings((current) => ({
      ...current,
      [locationId]: { page, customName, customIcon },
    }));
    await fetch("/api/settings/service-pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, page, customName, customIcon }),
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
          <div className="grid gap-4 lg:grid-cols-3">
            {locations.map((location) => (
              <div key={location.id} className="grid gap-3 rounded-2xl border border-black/5 bg-[#FBF7F9] p-4">
                <span className="text-sm font-semibold leading-5 border-b border-black/5 pb-2">{location.name}</span>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-black/45 block mb-1">Pagina principale</span>
                    <Select 
                      value={settings[location.id]?.page ?? 1} 
                      onChange={(event) => save(location.id, Number(event.target.value), settings[location.id]?.customName ?? "", settings[location.id]?.customIcon ?? "")}
                    >
                      <option value={1}>NOTE</option>
                      <option value={2}>TASK</option>
                      <option value={3}>FORMS</option>
                    </Select>
                  </div>
                  <div>
                    <span className="text-xs text-black/45 block mb-1">Nome personalizzato</span>
                    <input 
                      type="text" 
                      value={settings[location.id]?.customName ?? ""}
                      placeholder="es. Corsisti"
                      onChange={(event) => save(location.id, settings[location.id]?.page ?? 1, event.target.value, settings[location.id]?.customIcon ?? "")}
                      className="min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition placeholder:text-black/35 focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-black/45 block mb-1">Icona personalizzata</span>
                    <Select 
                      value={settings[location.id]?.customIcon ?? ""}
                      onChange={(event) => save(location.id, settings[location.id]?.page ?? 1, settings[location.id]?.customName ?? "", event.target.value)}
                    >
                      <option value="">Default della pagina</option>
                      {availableIcons.map((ico) => (
                        <option key={ico.value} value={ico.value}>{ico.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
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
