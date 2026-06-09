import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  CheckSquare, Download, Mail, Palette, PanelsTopLeft, 
  ShieldCheck, Smartphone, Table2, ClipboardList 
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { auth } from "@/lib/auth";

const allSettings = [
  { href: "/settings/branding", title: "Branding", text: "Colori, logo, dark mode e look premium.", icon: Palette, superAdminOnly: true },
  { href: "/settings/devices", title: "Dispositivi", text: "Tablet autorizzati e blocco timbrature.", icon: Smartphone, superAdminOnly: true },
  { href: "/settings/google-sheet", title: "Google Sheet", text: "Export e sync delle timbrature.", icon: Table2, superAdminOnly: true },
  { href: "/settings/email", title: "Email", text: "Provider e template notifiche.", icon: Mail, superAdminOnly: true },
  { href: "/settings/roles", title: "Ruoli", text: "Permessi per Super Admin, Admin, Responsabili e Dipendenti.", icon: ShieldCheck, superAdminOnly: true },
  { href: "/settings/forms", title: "Gestione Moduli", text: "Crea e configura moduli operativi per lo staff e visualizza le risposte.", icon: ClipboardList, superAdminOnly: false },
  { href: "/settings/app", title: "App Android", text: "Installa l'app sul tablet o scarica l'APK ufficiale.", icon: Download, superAdminOnly: true },
  { href: "/settings/services", title: "Pagine salone", text: "Assegna NOTE, TASK o FORMS come pagina visibile per ogni salone.", icon: PanelsTopLeft, superAdminOnly: true },
  { href: "/settings/tasks", title: "Task", text: "Categorie predefinite, commenti e impostazioni operative task.", icon: CheckSquare, superAdminOnly: true },
];

export default async function SettingsPage() {
  const session = await auth();
  const role = session?.user?.role;
  
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Filter settings based on user role
  const settings = allSettings.filter((s) => !s.superAdminOnly || role === "SUPER_ADMIN");

  return (
    <AppShell title="Impostazioni" subtitle="Configura il sistema, gestisci moduli per lo staff e personalizza il tuo portale.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settings.map((setting) => {
          const Icon = setting.icon;
          return (
            <Link key={setting.href} href={setting.href}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-luxury">
                <Icon className="size-6 text-paradise-noir/70 dark:text-white/70" />
                <h2 className="mt-5 text-xl font-semibold">{setting.title}</h2>
                <p className="mt-2 text-sm leading-6 text-black/55 dark:text-white/55">{setting.text}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
