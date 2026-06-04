import { AppShell } from "@/components/app-shell";
import { TaskSettings } from "@/components/task-settings";
import { prisma } from "@/lib/prisma";

const fallback = ["Operativa", "Sala", "Reception", "Bar", "Cucina", "Pulizia", "Magazzino", "Clienti"];

export const dynamic = "force-dynamic";

export default async function TaskSettingsPage() {
  const setting = process.env.DATABASE_URL ? await prisma.setting.findUnique({ where: { key: "task_categories" } }) : null;
  const categories = Array.isArray(setting?.value) ? setting.value.map(String) : fallback;

  return (
    <AppShell title="Impostazioni task" subtitle="Configura categorie e opzioni operative delle task.">
      <TaskSettings initialCategories={categories} />
    </AppShell>
  );
}
