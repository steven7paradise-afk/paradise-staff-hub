import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { routePermissions } from "@/lib/roles";

export default function RolesSettingsPage() {
  return (
    <AppShell title="Ruoli" subtitle="Matrice permessi usata dal middleware per proteggere pagine e aree operative.">
      <Card className="overflow-hidden p-0">
        {Object.entries(routePermissions).map(([route, roles]) => (
          <div key={route} className="grid gap-4 border-b border-black/5 p-5 last:border-b-0 lg:grid-cols-[220px_1fr] lg:items-center">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-black/45" />
              <p className="font-mono text-sm">{route}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => <Badge key={role} tone="gold">{role}</Badge>)}
            </div>
          </div>
        ))}
      </Card>
    </AppShell>
  );
}
