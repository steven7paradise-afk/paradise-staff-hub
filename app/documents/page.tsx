import Link from "next/link";
import { Download } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentUpload } from "@/components/document-upload";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const employeeView = session.user.role === "DIPENDENTE";
  const [documents, workers] = await Promise.all([
    prisma.document.findMany({
      where: employeeView ? { user_id: session.user.id } : undefined,
      include: { user: true },
      orderBy: { created_at: "desc" },
    }),
    !employeeView ? prisma.user.findMany({ where: { active: true, role: { not: "SUPER_ADMIN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <AppShell title="Documenti" subtitle={employeeView ? "Le tue buste paga e i tuoi documenti HR riservati." : "Buste paga, contratti e documenti HR con accesso riservato al dipendente corretto."}>
      {!employeeView ? <DocumentUpload workers={workers} /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {documents.length === 0 ? <Card className="text-sm text-black/50">Nessun documento disponibile.</Card> : null}
        {documents.map((document) => (
          <Card key={document.id}>
            <Badge tone="gold">{document.type}</Badge>
            <h2 className="mt-5 text-lg font-semibold">{document.title}</h2>
            {!employeeView ? <p className="mt-2 text-sm text-black/50">Destinato a: {document.user.name}</p> : null}
            <p className="mt-1 text-sm text-black/45">
              {document.month ? monthNames[document.month - 1] : ""} {document.year ?? ""}
            </p>
            <Link href={document.storage_path ? `/api/documents/${document.id}/download` : document.file_url} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-black/5 transition hover:bg-paradise-nude">
              <Download className="size-4" /> Scarica
            </Link>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
