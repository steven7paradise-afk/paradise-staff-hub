import Link from "next/link";
import { Download, FileText, Briefcase, Sparkles, Calendar, FolderOpen } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentUpload } from "@/components/document-upload";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const typeLabels = {
  BUSTA_PAGA: "Busta Paga",
  CONTRATTO: "Contratto",
  DOCUMENTO: "Documento HR",
};

function getDocIcon(type: string) {
  switch (type) {
    case "BUSTA_PAGA":
      return <Sparkles className="size-4.5 text-[#9E7A3B]" />;
    case "CONTRATTO":
      return <Briefcase className="size-4.5 text-slate-700" />;
    default:
      return <FileText className="size-4.5 text-[#B85B68]" />;
  }
}

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
    <AppShell 
      title="Documenti" 
      subtitle={employeeView ? "Le tue buste paga e i tuoi documenti HR riservati." : "Buste paga, contratti e documenti HR con accesso riservato al dipendente corretto."}
    >
      {!employeeView ? (
        <div className="mb-6">
          <DocumentUpload workers={workers} />
        </div>
      ) : null}
      
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {documents.length === 0 ? (
          <Card className="text-sm text-black/45 border border-black/5 bg-white/70 py-12 text-center col-span-full">
            <FolderOpen className="size-10 mx-auto text-black/20 mb-2" />
            Nessun documento disponibile nel tuo archivio.
          </Card>
        ) : null}
        
        {documents.map((document) => {
          const isPayslip = document.type === "BUSTA_PAGA";
          const isContract = document.type === "CONTRATTO";
          
          return (
            <Card 
              key={document.id}
              className={cn(
                "relative overflow-hidden p-5 border bg-white/95 transition-all duration-300 hover:shadow-luxury",
                isPayslip && "border-paradise-gold/30 bg-gradient-to-br from-white to-paradise-gold/5",
                isContract && "border-slate-300/40 bg-gradient-to-br from-white to-slate-100",
                !isPayslip && !isContract && "border-paradise-pink/20 bg-gradient-to-br from-white to-paradise-softPink/5"
              )}
            >
              {/* Top border colored stripe */}
              <div 
                className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  isPayslip && "bg-paradise-gold",
                  isContract && "bg-slate-700",
                  !isPayslip && !isContract && "bg-paradise-pink"
                )}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex size-9 items-center justify-center rounded-xl border shadow-sm",
                    isPayslip && "bg-paradise-gold/15 border-paradise-gold/30",
                    isContract && "bg-slate-100 border-slate-300/50",
                    !isPayslip && !isContract && "bg-paradise-pink/15 border-paradise-pink/30"
                  )}>
                    {getDocIcon(document.type)}
                  </div>
                  <span className="text-xs font-bold text-paradise-noir">
                    {typeLabels[document.type as keyof typeof typeLabels] || document.type}
                  </span>
                </div>

                {document.month && (
                  <Badge tone={isPayslip ? "gold" : "pink"}>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {monthNames[document.month - 1]} {document.year ?? ""}
                    </span>
                  </Badge>
                )}
              </div>

              {/* Title of document */}
              <h2 className="mt-5 text-base font-extrabold text-paradise-noir tracking-tight min-h-[44px] line-clamp-2">
                {document.title}
              </h2>

              {/* Destination employee tag for managers */}
              {!employeeView && (
                <div className="mt-4 flex items-center gap-2 border-t border-black/5 pt-3.5">
                  <div className="flex size-7.5 items-center justify-center rounded-full bg-paradise-pink/20 text-[#B85B68] text-xs font-extrabold shadow-sm border border-paradise-pink/30">
                    {document.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-paradise-noir leading-none">{document.user.name}</p>
                    <p className="text-[9px] text-black/40 font-semibold uppercase tracking-wide mt-0.5">Destinatario</p>
                  </div>
                </div>
              )}

              {/* Download Action button */}
              <Link 
                href={document.storage_path ? `/api/documents/${document.id}/download` : document.file_url} 
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white border border-black/5 px-4 py-2.5 text-sm font-bold text-paradise-noir shadow-sm transition-all duration-200 hover:bg-paradise-nude hover:scale-[1.01] hover:border-black/10 active:scale-[0.98]"
              >
                <Download className="size-4 text-[#B85B68]" /> Scarica file
              </Link>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

