import { RefreshCw, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field } from "@/components/ui";

export default function GoogleSheetSettingsPage() {
  return (
    <AppShell title="Google Sheet" subtitle="Configurazione del foglio per esportazione e report delle timbrature.">
      <Card className="max-w-3xl">
        <div className="space-y-4">
          <Field placeholder="Spreadsheet ID" />
          <Field placeholder="Nome tab, es. Timbrature" defaultValue="Timbrature" />
          <div className="rounded-2xl bg-paradise-nude p-4 text-sm text-black/60">
            Le credenziali service account restano in variabili ambiente su Netlify.
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button><Save className="size-4" /> Salva</Button>
          <Button variant="soft"><RefreshCw className="size-4" /> Test sync</Button>
        </div>
      </Card>
    </AppShell>
  );
}
