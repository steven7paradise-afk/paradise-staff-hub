import Link from "next/link";
import { Download, Mail, Palette, ShieldCheck, Smartphone, Table2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

const settings = [
  { href: "/settings/branding", title: "Branding", text: "Colori, logo, dark mode e look premium.", icon: Palette },
  { href: "/settings/devices", title: "Dispositivi", text: "Tablet autorizzati e blocco timbrature.", icon: Smartphone },
  { href: "/settings/google-sheet", title: "Google Sheet", text: "Export e sync delle timbrature.", icon: Table2 },
  { href: "/settings/email", title: "Email", text: "Provider e template notifiche.", icon: Mail },
  { href: "/settings/roles", title: "Ruoli", text: "Permessi per Super Admin, Admin, Responsabili e Dipendenti.", icon: ShieldCheck },
  { href: "/settings/app", title: "App Android", text: "Installa l'app sul tablet o scarica l'APK ufficiale.", icon: Download },
];

export default function SettingsPage() {
  return (
    <AppShell title="Impostazioni" subtitle="Console Super Admin per configurare sistema, identita visiva, sedi e integrazioni.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settings.map((setting) => {
          const Icon = setting.icon;
          return (
            <Link key={setting.href} href={setting.href}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-luxury">
                <Icon className="size-6 text-paradise-noir/70" />
                <h2 className="mt-5 text-xl font-semibold">{setting.title}</h2>
                <p className="mt-2 text-sm leading-6 text-black/55">{setting.text}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
