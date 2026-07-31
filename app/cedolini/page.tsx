import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentsViewer, type DocumentRecord } from "@/components/documents-viewer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export default async function CedoliniPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  
  if (!allowedRoles.has(session.user.role)) {
    redirect("/dashboard");
  }

  const [documents, workers] = await Promise.all([
    prisma.document.findMany({
      include: { user: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.user.findMany({
      where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
      select: { id: true, name: true, role: true, mansione: true },
      orderBy: { name: "asc" },
    }),
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
      title="Cedolini" 
      subtitle="Carica e gestisci i cedolini, contratti e documenti HR di tutti i collaboratori."
      hidePageHeaderOnMobile
    >
      <div className="mb-6">
        <DocumentUpload workers={workers} />
      </div>
      
      <DocumentsViewer documents={documentItems} employeeView={false} workers={workers} />
    </AppShell>
  );
}
