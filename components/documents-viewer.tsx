"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Briefcase,
  Calendar,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Sparkles,
  UserRound,
  Trash2,
  Search,
  X,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export type DocumentRecord = {
  id: string;
  title: string;
  type: string;
  month: number | null;
  year: number | null;
  file_url: string;
  storage_path: string | null;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const typeLabels: Record<string, string> = {
  BUSTA_PAGA: "Busta paga",
  CONTRATTO: "Contratto",
  DOCUMENTO: "Documento HR",
};

function getDocIcon(type: string) {
  switch (type) {
    case "BUSTA_PAGA":
      return <Sparkles className="size-5 text-[#9E7A3B]" />;
    case "CONTRATTO":
      return <Briefcase className="size-5 text-slate-700" />;
    default:
      return <FileText className="size-5 text-[#B85B68]" />;
  }
}

function getDocumentUrl(document: DocumentRecord) {
  return `/api/documents/${document.id}/download`;
}

function getFileExtension(document: DocumentRecord) {
  const source = document.storage_path || document.file_url || document.title;
  const clean = source.split("?")[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]+)$/);
  if (match?.[1]) return match[1];
  if (document.type === "BUSTA_PAGA" || document.type === "CONTRATTO") return "pdf";
  return "";
}

function isPdf(document: DocumentRecord) {
  return getFileExtension(document) === "pdf";
}

function isImage(document: DocumentRecord) {
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(getFileExtension(document));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function documentPeriod(document: DocumentRecord) {
  if (!document.month) return null;
  return `${monthNames[document.month - 1]} ${document.year ?? ""}`.trim();
}

function DocumentMeta({ document, employeeView }: { document: DocumentRecord; employeeView: boolean }) {
  const period = documentPeriod(document);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={document.type === "BUSTA_PAGA" ? "gold" : document.type === "CONTRATTO" ? "dark" : "pink"}>
        {typeLabels[document.type] || document.type}
      </Badge>
      {period ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white px-3 py-1 text-xs font-semibold text-black/55">
          <Calendar className="size-3" />
          {period}
        </span>
      ) : null}
      {!employeeView ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white px-3 py-1 text-xs font-semibold text-black/55">
          <UserRound className="size-3" />
          {document.user.name}
        </span>
      ) : null}
    </div>
  );
}

function PreviewFrame({ document, className }: { document: DocumentRecord; className?: string }) {
  const url = getDocumentUrl(document);

  if (isPdf(document)) {
    return (
      <iframe
        title={`Anteprima ${document.title}`}
        src={`${url}#toolbar=1&navpanes=0&view=FitH`}
        className={cn("h-full min-h-[56dvh] w-full rounded-3xl border border-black/5 bg-white", className)}
      />
    );
  }

  if (isImage(document)) {
    return (
      <div className={cn("flex h-full min-h-[56dvh] items-center justify-center rounded-3xl border border-black/5 bg-[#faf7f9] p-4", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={document.title} className="max-h-full max-w-full rounded-2xl object-contain shadow-sm" />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-[56dvh] flex-col items-center justify-center rounded-3xl border border-black/5 bg-[#faf7f9] p-8 text-center", className)}>
      <div className="flex size-16 items-center justify-center rounded-3xl bg-white shadow-sm">
        <FileText className="size-7 text-[#B85B68]" />
      </div>
      <h3 className="mt-5 text-lg font-extrabold text-paradise-noir">Anteprima non disponibile</h3>
      <p className="mt-2 max-w-sm text-sm text-black/50">Questo tipo di file puo essere aperto o scaricato dal pulsante qui sotto.</p>
      <a href={url} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-paradise-pink px-5 text-sm font-bold text-paradise-noir shadow-sm">
        <Download className="size-4" />
        Apri file
      </a>
    </div>
  );
}

function DesktopDocumentRow({
  document,
  employeeView,
  selected,
  onSelect,
}: {
  document: DocumentRecord;
  employeeView: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-3xl border bg-white p-4 text-left transition hover:border-paradise-pink/45 hover:bg-paradise-softPink/15",
        selected ? "border-paradise-pink bg-paradise-softPink/25 shadow-sm" : "border-black/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm">{getDocIcon(document.type)}</div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-extrabold text-paradise-noir">{document.title}</h3>
          <p className="mt-1 text-xs font-semibold text-black/40">{formatDate(document.created_at)}</p>
          <div className="mt-3">
            <DocumentMeta document={document} employeeView={employeeView} />
          </div>
        </div>
      </div>
    </button>
  );
}

function MobileDocumentCard({
  document,
  employeeView,
  onPreview,
}: {
  document: DocumentRecord;
  employeeView: boolean;
  onPreview: () => void;
}) {
  const url = getDocumentUrl(document);

  return (
    <Card className="rounded-[28px] p-4 hover:translate-y-0">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm">{getDocIcon(document.type)}</div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-extrabold text-paradise-noir">{document.title}</h3>
          <p className="mt-1 text-xs font-semibold text-black/40">{formatDate(document.created_at)}</p>
        </div>
      </div>
      <div className="mt-3">
        <DocumentMeta document={document} employeeView={employeeView} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-black/5 bg-white text-sm font-bold text-paradise-noir shadow-sm active:scale-[0.98]"
        >
          <Eye className="size-4 text-[#B85B68]" />
          {isPdf(document) ? "Vedi PDF" : "Vedi file"}
        </button>
        <a
          href={url}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-paradise-pink text-sm font-bold text-paradise-noir shadow-sm active:scale-[0.98]"
        >
          <Download className="size-4" />
          Scarica
        </a>
      </div>
    </Card>
  );
}

function DesktopPreview({
  document,
  employeeView,
  onDelete,
  deletingId
}: {
  document: DocumentRecord;
  employeeView: boolean;
  onDelete?: (id: string) => void;
  deletingId?: string;
}) {
  const url = getDocumentUrl(document);

  return (
    <Card className="sticky top-24 h-[calc(100dvh-8rem)] overflow-hidden rounded-[32px] p-0 hover:translate-y-0">
      <div className="flex items-start justify-between gap-4 border-b border-black/5 bg-white/90 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#B85B68]">Anteprima documento</p>
          <h2 className="mt-2 line-clamp-2 text-xl font-extrabold text-paradise-noir">{document.title}</h2>
          <div className="mt-3">
            <DocumentMeta document={document} employeeView={employeeView} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!employeeView && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(document.id)}
              disabled={deletingId === document.id}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-55 px-4 text-sm font-bold text-red-700 shadow-sm border border-red-100 hover:bg-red-100 transition disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              {deletingId === document.id ? "Eliminazione..." : "Elimina"}
            </button>
          )}
          <a
            href={url}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-paradise-pink px-4 text-sm font-bold text-paradise-noir shadow-sm transition hover:brightness-105"
          >
            <Download className="size-4" />
            Scarica
          </a>
        </div>
      </div>
      <div className="h-[calc(100%-120px)] p-4">
        <PreviewFrame document={document} className="min-h-0 rounded-3xl" />
      </div>
    </Card>
  );
}

function MobilePreviewModal({
  document,
  employeeView,
  onClose,
}: {
  document: DocumentRecord;
  employeeView: boolean;
  onClose: () => void;
}) {
  const url = getDocumentUrl(document);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden">
      <div className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-[34px] border border-white/40 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/5 p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.26em] text-[#B85B68]">Anteprima</p>
            <h2 className="mt-1 line-clamp-2 text-lg font-extrabold text-paradise-noir">{document.title}</h2>
            <div className="mt-2">
              <DocumentMeta document={document} employeeView={employeeView} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-black/5 text-paradise-noir">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <PreviewFrame document={document} className="min-h-[58dvh] rounded-3xl" />
        </div>
        <div className="border-t border-black/5 p-3">
          <a href={url} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-paradise-pink text-sm font-bold text-paradise-noir shadow-sm">
            <Download className="size-4" />
            Scarica documento
          </a>
        </div>
      </div>
    </div>
  );
}

export function DocumentsViewer({
  documents,
  employeeView,
  workers = [],
}: {
  documents: DocumentRecord[];
  employeeView: boolean;
  workers?: { id: string; name: string; role?: string; mansione?: string | null }[];
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState("");
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? "");
  const [mobilePreview, setMobilePreview] = useState<DocumentRecord | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(documents[0]?.id ?? null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");

  // Delivery status verification states
  const now = new Date();
  let defaultMonth = now.getMonth(); // 0-indexed, so 6 is July. 6 in 1-indexed is June.
  let defaultYear = now.getFullYear();
  if (defaultMonth === 0) {
    defaultMonth = 12;
    defaultYear -= 1;
  }

  const [statusMonth, setStatusMonth] = useState(defaultMonth);
  const [statusYear, setStatusYear] = useState(defaultYear);
  const [workerSearchQuery, setWorkerSearchQuery] = useState("");

  const workersList = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const ids = new Set<string>();
    documents.forEach((doc) => {
      if (doc.user && !ids.has(doc.user.id)) {
        ids.add(doc.user.id);
        list.push({ id: doc.user.id, name: doc.user.name });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  const yearsList = useMemo(() => {
    const years = new Set<number>();
    documents.forEach((doc) => {
      if (doc.year) years.add(doc.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [documents]);

  const workersWithStatus = useMemo(() => {
    if (employeeView) return [];
    
    // Map workerId -> has BUSTA_PAGA for selected month and year
    const statusMap = new Map<string, { hasDoc: boolean; docId?: string; dateUploaded?: string }>();
    
    documents.forEach((doc) => {
      if (doc.type === "BUSTA_PAGA" && doc.month === statusMonth && doc.year === statusYear) {
        statusMap.set(doc.user.id, {
          hasDoc: true,
          docId: doc.id,
          dateUploaded: doc.created_at,
        });
      }
    });
    
    return workers.map((w) => {
      const statusInfo = statusMap.get(w.id);
      return {
        ...w,
        hasDoc: statusInfo?.hasDoc ?? false,
        docId: statusInfo?.docId,
        dateUploaded: statusInfo?.dateUploaded,
      };
    });
  }, [workers, documents, statusMonth, statusYear, employeeView]);

  const filteredWorkers = useMemo(() => {
    if (!workerSearchQuery.trim()) return workersWithStatus;
    const query = workerSearchQuery.toLowerCase();
    return workersWithStatus.filter((w) => w.name.toLowerCase().includes(query));
  }, [workersWithStatus, workerSearchQuery]);

  const stats = useMemo(() => {
    const total = workersWithStatus.length;
    const completed = workersWithStatus.filter((w) => w.hasDoc).length;
    const missing = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const missingWorkers = workersWithStatus.filter((w) => !w.hasDoc);
    const completedWorkers = workersWithStatus.filter((w) => w.hasDoc);
    
    return { total, completed, missing, percentage, missingWorkers, completedWorkers };
  }, [workersWithStatus]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(query);
        const matchUser = doc.user?.name.toLowerCase().includes(query);
        if (!matchTitle && !matchUser) return false;
      }
      if (selectedWorkerId && doc.user?.id !== selectedWorkerId) {
        return false;
      }
      if (selectedType !== "ALL" && doc.type !== selectedType) {
        return false;
      }
      if (selectedYear !== "ALL" && String(doc.year) !== selectedYear) {
        return false;
      }
      return true;
    });
  }, [documents, searchQuery, selectedWorkerId, selectedType, selectedYear]);

  async function handleDelete(id: string) {
    if (!window.confirm("Sei sicuro di voler eliminare questo documento per sempre?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Errore durante l'eliminazione.");
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione.");
    } finally {
      setDeletingId("");
    }
  }

  const selectedDocument = useMemo(() => filteredDocuments.find((document) => document.id === selectedId) ?? filteredDocuments[0], [filteredDocuments, selectedId]);

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
    const workerDocs = documents.filter((d) => d.user.id === workerId);
    if (workerDocs.length > 0) {
      setSelectedId(workerDocs[0].id);
    } else {
      setSelectedId("");
    }
  };

  if (documents.length === 0 && workers.length === 0) {
    return (
      <Card className="border border-black/5 bg-white/70 py-12 text-center text-sm text-black/45 hover:translate-y-0">
        <FolderOpen className="mx-auto mb-2 size-10 text-black/20" />
        Nessun documento o collaboratore disponibile nel tuo archivio.
      </Card>
    );
  }

  const showPersonnelTable = !employeeView && workers.length > 0 && selectedWorkerId === "";

  return (
    <div className="operations-liquid-page documents-liquid min-h-[calc(100dvh-12rem)] rounded-[32px] border border-white/70 p-4 shadow-[0_18px_55px_rgba(61,35,49,0.08)] backdrop-blur-2xl sm:p-5">
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 1023px) {
          body,
          .paradise-theme-root {
            background-color: #0A0A0A !important;
            background: #0A0A0A !important;
          }
          div:has(> .documents-page),
          div:has(> * > .documents-page),
          div:has(> * > * > .documents-page),
          div:has(> * > * > * > .documents-page) {
            background-color: #0A0A0A !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
        }
      `}} />
      
      {/* MOBILE VERSION (lg:hidden) */}
      <div className="space-y-4 lg:hidden bg-[#0A0A0A] rounded-[32px] p-5 border border-white/5 shadow-2xl documents-page">
        {showPersonnelTable ? (
          /* MOBILE: Personnel Status Table */
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-[24px] border border-white/5 space-y-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#B85B68]">Stato Consegne</p>
              <h2 className="text-lg font-extrabold text-white">Consegna Cedolini</h2>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cerca collaboratore..."
                  value={workerSearchQuery}
                  onChange={(e) => setWorkerSearchQuery(e.target.value)}
                  className="w-full h-11 pl-9 pr-4 rounded-xl border border-white/10 bg-white/5 text-white text-xs font-semibold outline-none focus:border-[#B85B68] focus:ring-1 focus:ring-[#B85B68]/30 transition"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                {workerSearchQuery && (
                  <button onClick={() => setWorkerSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={statusMonth}
                  onChange={(e) => setStatusMonth(Number(e.target.value))}
                  className="h-11 rounded-xl border border-white/10 bg-[#0A0A0A] text-white px-2.5 text-[11px] font-bold outline-none cursor-pointer"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={statusYear}
                  onChange={(e) => setStatusYear(Number(e.target.value))}
                  className="h-11 rounded-xl border border-white/10 bg-[#0A0A0A] text-white px-2.5 text-[11px] font-bold outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {filteredWorkers.map((worker) => (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => handleSelectWorker(worker.id)}
                  className="w-full rounded-2xl border border-white/5 bg-white/5 p-4 text-left flex items-center justify-between transition-all active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <h3 className="text-sm font-extrabold text-white truncate">{worker.name}</h3>
                    <p className="text-xs text-white/40 mt-0.5 font-semibold truncate">
                      {worker.mansione || (worker.role === "ADMIN" ? "Amministrazione" : "Collaboratore")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {worker.hasDoc ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Caricato
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-extrabold text-rose-400 border border-rose-500/20">
                        <span className="size-1.5 rounded-full bg-rose-400" />
                        Mancante
                      </span>
                    )}
                    <ChevronRight className="size-4 text-white/30" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* MOBILE: User Document List (Original View adjusted for specific worker or self) */
          <>
            <div className="bg-white/5 p-4 rounded-[24px] border border-white/5 space-y-3">
              {!employeeView && (
                <button
                  onClick={() => setSelectedWorkerId("")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B85B68] hover:underline mb-1"
                >
                  <ArrowLeft className="size-3.5" />
                  Torna al personale
                </button>
              )}
              
              <h2 className="text-lg font-extrabold text-white">
                {employeeView ? "I tuoi documenti" : `Documenti di ${workers.find((w) => w.id === selectedWorkerId)?.name}`}
              </h2>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Cerca per titolo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-9 pr-4 rounded-xl border border-white/10 bg-white/5 text-white text-xs font-semibold outline-none focus:border-[#B85B68] focus:ring-1 focus:ring-[#B85B68]/30 transition"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-[#0A0A0A] text-white px-2.5 text-[11px] font-bold outline-none cursor-pointer"
                >
                  <option value="ALL">Tutti i tipi</option>
                  <option value="BUSTA_PAGA">Busta paga</option>
                  <option value="CONTRATTO">Contratto</option>
                  <option value="DOCUMENTO">Documento HR</option>
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-[#0A0A0A] text-white px-2.5 text-[11px] font-bold outline-none cursor-pointer"
                >
                  <option value="ALL">Tutti gli anni</option>
                  {yearsList.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="border border-white/5 bg-white/5 py-12 text-center text-sm text-white/45 rounded-[24px]">
                Nessun documento trovato.
              </div>
            ) : (
              filteredDocuments.map((doc, idx) => {
                const colors = [
                  { bg: "bg-[#A1B5FD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                  { bg: "bg-[#FDCB82]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                  { bg: "bg-[#8DE0BD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                  { bg: "bg-[#F7A1C4]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                ];
                const color = colors[idx % colors.length];
                const isExpanded = expandedId === doc.id;
                const period = documentPeriod(doc);
                const url = getDocumentUrl(doc);

                return (
                  <div
                    key={doc.id}
                    onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                    className={cn(
                      "w-full rounded-[28px] p-5 transition-all duration-300 cursor-pointer shadow-sm relative overflow-hidden select-none",
                      color.bg,
                      color.text,
                      isExpanded ? "flex flex-col gap-4" : "h-[72px] flex items-center justify-between"
                    )}
                  >
                    {isExpanded ? (
                      <div className="flex flex-col justify-between w-full">
                        <div>
                          <div className="flex justify-between items-start gap-3">
                            <h3 className="text-base font-extrabold pr-8 leading-tight line-clamp-2">{doc.title}</h3>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMobilePreview(doc);
                              }}
                              className={cn(
                                "size-9 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0",
                                color.arrowBg,
                                color.arrowText
                              )}
                            >
                              <ArrowUpRight className="size-4.5" />
                            </button>
                          </div>
                          <div className="mt-4 space-y-2 text-xs font-semibold opacity-85">
                            <p className="flex items-center gap-2">
                              <span className="opacity-60">Tipo:</span>
                              <span>{typeLabels[doc.type] || doc.type}</span>
                            </p>
                            {period && (
                              <p className="flex items-center gap-2">
                                <span className="opacity-60">Periodo:</span>
                                <span>{period}</span>
                              </p>
                            )}
                            <p className="flex items-center gap-2">
                              <span className="opacity-60">Caricato il:</span>
                              <span>{formatDate(doc.created_at)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="mt-5 space-y-2 pt-3 border-t border-black/10">
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMobilePreview(doc);
                              }}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/40 backdrop-blur-sm text-sm font-bold text-current border border-black/5 active:scale-95 transition"
                            >
                              <Eye className="size-4" />
                              Visualizza
                            </button>
                            <a
                              href={url}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white text-sm font-bold active:scale-95 transition"
                            >
                              <Download className="size-4" />
                              Scarica
                            </a>
                          </div>
                          {!employeeView && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(doc.id);
                              }}
                              disabled={deletingId === doc.id}
                              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-600/90 text-white text-sm font-bold active:scale-[0.97] transition disabled:opacity-50"
                            >
                              <Trash2 className="size-4" />
                              {deletingId === doc.id ? "Eliminazione..." : "Elimina"}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-sm font-extrabold truncate pr-4">{doc.title}</h3>
                        <div className={cn("size-9 rounded-full flex items-center justify-center shadow-sm shrink-0", color.arrowBg, color.arrowText)}>
                          <ArrowUpRight className="size-4" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* DESKTOP VERSION (hidden lg:grid) */}
      <div className="hidden grid-cols-12 gap-5 lg:grid">
        <Card className="col-span-5 max-h-[calc(100dvh-8rem)] overflow-hidden p-0 hover:translate-y-0 flex flex-col">
          {showPersonnelTable ? (
            /* DESKTOP: Left Side - Personnel list with delivery status indicators */
            <>
              <div className="border-b border-black/5 bg-white/80 p-5 shrink-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-black/35">Stato Consegne</p>
                <h2 className="mt-1 text-xl font-extrabold text-paradise-noir">Consegna Cedolini</h2>
              </div>

              <div className="border-b border-black/5 bg-slate-50/50 p-4 space-y-3 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cerca collaboratore..."
                    value={workerSearchQuery}
                    onChange={(e) => setWorkerSearchQuery(e.target.value)}
                    className="h-11 w-full rounded-xl border border-black/10 bg-white pl-9 pr-4 text-xs font-semibold outline-none transition focus:border-[#B85B68] focus:ring-2 focus:ring-[#B85B68]/20"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/30" />
                  {workerSearchQuery && (
                    <button onClick={() => setWorkerSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-black/30 hover:text-black/60">
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={statusMonth}
                    onChange={(e) => setStatusMonth(Number(e.target.value))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-black/[0.01]"
                  >
                    {monthNames.map((name, index) => (
                      <option key={index} value={index + 1}>{name}</option>
                    ))}
                  </select>

                  <select
                    value={statusYear}
                    onChange={(e) => setStatusYear(Number(e.target.value))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-black/[0.01]"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] font-semibold text-black/40 italic">
                  * Finestra di consegna: dal 1 al 15 del mese successivo.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 p-4 min-h-0">
                {filteredWorkers.length === 0 ? (
                  <div className="border border-black/5 bg-white/70 py-12 text-center text-sm text-black/45 rounded-3xl">
                    Nessun collaboratore trovato.
                  </div>
                ) : (
                  filteredWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      type="button"
                      onClick={() => handleSelectWorker(worker.id)}
                      className="w-full rounded-2xl border border-black/5 bg-white p-3.5 text-left flex items-center justify-between transition hover:border-[#B85B68]/30 hover:bg-slate-50/50"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <h3 className="text-sm font-extrabold text-paradise-noir truncate">{worker.name}</h3>
                        <p className="text-xs text-black/45 mt-0.5 font-semibold truncate">
                          {worker.mansione || (worker.role === "ADMIN" ? "Amministrazione" : "Collaboratore")}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {worker.hasDoc ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                            <span className="size-2 rounded-full bg-emerald-500" />
                            Caricato
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-rose-700">
                            <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                            Mancante
                          </span>
                        )}
                        <ChevronRight className="size-4 text-black/20" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            /* DESKTOP: Left Side - Selected worker's document archive (original style) */
            <>
              <div className="border-b border-black/5 bg-white/80 p-5 shrink-0">
                {!employeeView && (
                  <button
                    onClick={() => setSelectedWorkerId("")}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B85B68] hover:underline mb-2"
                  >
                    <ArrowLeft className="size-3.5" />
                    Torna al personale
                  </button>
                )}
                
                <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-black/35">Archivio documenti</p>
                <h2 className="mt-1 text-xl font-extrabold text-paradise-noir truncate">
                  {employeeView ? "I tuoi documenti" : `${workers.find((w) => w.id === selectedWorkerId)?.name}`}
                </h2>
              </div>

              <div className="border-b border-black/5 bg-slate-50/50 p-4 space-y-3 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cerca per titolo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 w-full rounded-xl border border-black/10 bg-white pl-9 pr-4 text-xs font-semibold outline-none transition focus:border-[#B85B68] focus:ring-2 focus:ring-[#B85B68]/20"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/30" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-black/30 hover:text-black/60">
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="h-11 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-black/[0.01]"
                  >
                    <option value="ALL">Tutti i tipi</option>
                    <option value="BUSTA_PAGA">Busta paga</option>
                    <option value="CONTRATTO">Contratto</option>
                    <option value="DOCUMENTO">Documento HR</option>
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-11 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-black/[0.01]"
                  >
                    <option value="ALL">Tutti gli anni</option>
                    {yearsList.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0">
                {filteredDocuments.length === 0 ? (
                  <div className="border border-black/5 bg-white/70 py-12 text-center text-sm text-black/45 rounded-3xl">
                    Nessun documento trovato.
                  </div>
                ) : (
                  filteredDocuments.map((document) => (
                    <DesktopDocumentRow
                      key={document.id}
                      document={document}
                      employeeView={employeeView}
                      selected={selectedDocument?.id === document.id}
                      onSelect={() => setSelectedId(document.id)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </Card>

        {/* DESKTOP: Right Side Panel */}
        <div className="col-span-7 min-w-0">
          {showPersonnelTable ? (
            /* DESKTOP: Right Side - Statistics dashboard */
            <Card className="sticky top-24 h-[calc(100dvh-8rem)] overflow-hidden rounded-[32px] p-0 hover:translate-y-0 flex flex-col bg-white">
              <div className="border-b border-black/5 bg-gradient-to-r from-slate-50/50 to-white p-6 shrink-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#B85B68]">Riepilogo Consegne</p>
                <h2 className="mt-2 text-2xl font-extrabold text-paradise-noir">
                  {monthNames[statusMonth - 1]} {statusYear}
                </h2>
                <p className="mt-1 text-sm font-semibold text-black/40">
                  Stato di caricamento dei cedolini (Busta Paga) per i collaboratori.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-4 shrink-0">
                  <div className="rounded-2xl border border-black/5 bg-slate-50/50 p-4 text-center flex flex-col justify-between">
                    <p className="text-[10px] font-extrabold text-black/35 uppercase tracking-wider">Completamento</p>
                    <p className="mt-2 text-3xl font-extrabold text-[#B85B68]">{stats.percentage}%</p>
                    <div className="mt-3 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 text-center flex flex-col justify-between">
                    <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Caricati</p>
                    <p className="mt-2 text-3xl font-extrabold text-emerald-700">{stats.completed}</p>
                    <p className="mt-1 text-[10px] text-emerald-600/70 font-semibold">su {stats.total} totali</p>
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4 text-center flex flex-col justify-between">
                    <p className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">Mancanti</p>
                    <p className="mt-2 text-3xl font-extrabold text-rose-700">{stats.missing}</p>
                    <p className="mt-1 text-[10px] text-rose-600/70 font-semibold">da caricare</p>
                  </div>
                </div>

                {/* Columns Grid */}
                <div className="grid grid-cols-2 gap-5 h-[calc(100%-120px)] min-h-[300px]">
                  {/* Missing Panel */}
                  <div className="border border-black/5 rounded-2xl p-4 flex flex-col bg-slate-50/20 min-h-0">
                    <h3 className="text-xs font-extrabold text-rose-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 shrink-0">
                      <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                      Da consegnare ({stats.missing})
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                      {stats.missingWorkers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <CheckCircle2 className="size-10 text-emerald-500 mb-2" />
                          <p className="text-xs font-extrabold text-emerald-700">Tutto caricato!</p>
                          <p className="text-[10px] text-black/40 mt-1 max-w-[160px]">
                            Tutti i collaboratori hanno ricevuto il cedolino per questo periodo.
                          </p>
                        </div>
                      ) : (
                        stats.missingWorkers.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-white border border-black/5 shadow-sm hover:border-[#B85B68]/30 transition"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-extrabold text-paradise-noir truncate">{w.name}</p>
                              <p className="text-[10px] text-black/45 font-semibold truncate">
                                {w.mansione || "Collaboratore"}
                              </p>
                            </div>
                            <button
                              onClick={() => handleSelectWorker(w.id)}
                              className="px-3 py-1 text-[10px] font-bold bg-[#B85B68] text-white rounded-lg hover:brightness-105 active:scale-95 transition shrink-0"
                            >
                              Gestisci
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Completed Panel */}
                  <div className="border border-black/5 rounded-2xl p-4 flex flex-col bg-slate-50/20 min-h-0">
                    <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 shrink-0">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Consegnati ({stats.completed})
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                      {stats.completedWorkers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-black/35">
                          <p className="text-xs font-bold">Nessun caricamento</p>
                          <p className="text-[10px] text-black/45 mt-1 max-w-[160px]">
                            Non ci sono buste paga caricate per questo mese di riferimento.
                          </p>
                        </div>
                      ) : (
                        stats.completedWorkers.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-white border border-black/5 shadow-sm hover:border-emerald-300 transition"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-extrabold text-paradise-noir truncate">{w.name}</p>
                              <p className="text-[9px] text-emerald-600 font-extrabold truncate">
                                Caricato il: {w.dateUploaded ? formatDate(w.dateUploaded) : ""}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                handleSelectWorker(w.id);
                                if (w.docId) setSelectedId(w.docId);
                              }}
                              className="px-3 py-1 text-[10px] font-bold border border-black/5 bg-slate-50 hover:bg-slate-100 rounded-lg active:scale-95 transition shrink-0"
                            >
                              Vedi PDF
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : selectedDocument ? (
            /* DESKTOP: Right Side - Original Document Preview */
            <DesktopPreview
              document={selectedDocument}
              employeeView={employeeView}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ) : (
            <Card className="sticky top-24 h-[calc(100dvh-8rem)] flex items-center justify-center rounded-[32px] border border-black/5 bg-[#faf7f9] p-8 text-center">
              <div>
                <FileText className="size-10 mx-auto text-black/20 mb-3" />
                <p className="text-sm font-extrabold text-paradise-noir">Nessun documento selezionato</p>
                <p className="text-xs text-black/45 mt-1">Seleziona un documento a sinistra per visualizzarne l'anteprima.</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {mobilePreview ? <MobilePreviewModal document={mobilePreview} employeeView={employeeView} onClose={() => setMobilePreview(null)} /> : null}
    </div>
  );
}
