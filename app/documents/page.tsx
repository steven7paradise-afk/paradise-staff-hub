import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentsViewer, type DocumentRecord } from "@/components/documents-viewer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

  const documentItems: DocumentRecord[] = documents.map((document) => ({
    id: document.id,
    title: document.title,
    type: document.type,
    month: document.month,
    year: document.year,
    file_url: document.file_url,
    storage_path: document.storage_path,
    created_at: document.created_at.toISOString(),
    user: {
      id: document.user.id,
      name: document.user.name,
      email: document.user.email,
    },
  }));

  return (
    <AppShell 
      title="Documenti" 
      subtitle={employeeView ? "Le tue buste paga e i tuoi documenti HR riservati." : "Buste paga, contratti e documenti HR con accesso riservato al dipendente corretto."}
      hidePageHeaderOnMobile
    >
      {!employeeView ? (
        <div className="mb-6">
          <DocumentUpload workers={workers} />
        </div>
      ) : null}
      
      <DocumentsViewer documents={documentItems} employeeView={employeeView} />
    </AppShell>
  );
}
