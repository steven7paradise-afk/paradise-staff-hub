import { redirect } from "next/navigation";
import { ArrowUpRight, FilePenLine, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { requireServicePageAccess } from "@/lib/service-page-access";

export const dynamic = "force-dynamic";

export default async function ServiceNotesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  await requireServicePageAccess(role, session.user.sedeId, 1);

  return (
    <AppShell title="NOTE" role={role} hideHeader>
      <div className="space-y-5">
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-paradise-softPink text-[#A74758]">
                <FilePenLine className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Pagina operativa</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">NOTE</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">Spazio ordinato per comunicazioni interne, procedure e promemoria del salone.</p>
              </div>
            </div>
            <button className="hidden rounded-2xl border border-black/5 bg-[#FBF7F9] px-4 py-3 text-sm font-semibold sm:inline-flex">
              <Plus className="mr-2 size-4" /> Nuova nota
            </button>
          </div>
        </div>
        <Card className="bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-4">
            <h2 className="font-semibold">Note recenti</h2>
            <ArrowUpRight className="size-4 text-black/35" />
          </div>
          <p className="mt-5 rounded-2xl bg-[#FBF7F9] px-4 py-6 text-sm text-black/50">Nessuna nota inserita.</p>
        </Card>
      </div>
    </AppShell>
  );
}
