import { MailCheck, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field, Select } from "@/components/ui";

export default function EmailSettingsPage() {
  return (
    <AppShell title="Email" subtitle="Provider configurabile per notifiche HR, buste paga, ferie e riepiloghi ore.">
      <Card className="max-w-3xl">
        <div className="grid gap-4 md:grid-cols-2">
          <Select defaultValue="resend">
            <option value="resend">Resend</option>
            <option value="brevo">Brevo</option>
          </Select>
          <Field placeholder="Paradise Beauty HR" />
          <Field placeholder="hr@paradisebeauty.it" />
          <Field placeholder="API key in env" disabled />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button><Save className="size-4" /> Salva</Button>
          <Button variant="soft"><MailCheck className="size-4" /> Invia test</Button>
        </div>
      </Card>
    </AppShell>
  );
}
