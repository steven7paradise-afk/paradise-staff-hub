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
  return document.storage_path ? `/api/documents/${document.id}/download` : document.file_url;
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

export function DocumentsViewer({ documents, employeeView }: { documents: DocumentRecord[]; employeeView: boolean }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState("");
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? "");
  const [mobilePreview, setMobilePreview] = useState<DocumentRecord | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(documents[0]?.id ?? null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");

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

  if (documents.length === 0) {
    return (
      <Card className="border border-black/5 bg-white/70 py-12 text-center text-sm text-black/45 hover:translate-y-0">
        <FolderOpen className="mx-auto mb-2 size-10 text-black/20" />
        Nessun documento disponibile nel tuo archivio.
      </Card>
    );
  }

  return (
    <>
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
      <div className="space-y-4 lg:hidden bg-[#0A0A0A] rounded-[32px] p-5 border border-white/5 shadow-2xl documents-page">
        {/* Mobile Filters Panel */}
        <div className="space-y-3 bg-white/5 p-4 rounded-[24px] border border-white/5 mb-2">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cerca per titolo o collaboratore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-4 rounded-xl border border-white/10 bg-white/5 text-white text-xs font-semibold outline-none focus:border-[#B85B68] focus:ring-1 focus:ring-[#B85B68]/30 transition"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-white/30 hover:text-white/60">
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Employee Filter */}
            {!employeeView && (
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-white/5 text-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-white/[0.02]"
              >
                <option value="" className="bg-[#0A0A0A] text-white">Tutti i dipendenti</option>
                {workersList.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#0A0A0A] text-white">
                    {w.name}
                  </option>
                ))}
              </select>
            )}

            {/* Document Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={cn(
                "h-10 rounded-xl border border-white/10 bg-white/5 text-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-white/[0.02]",
                employeeView && "col-span-2"
              )}
            >
              <option value="ALL" className="bg-[#0A0A0A] text-white">Tutti i tipi</option>
              <option value="BUSTA_PAGA" className="bg-[#0A0A0A] text-white">Busta paga</option>
              <option value="CONTRATTO" className="bg-[#0A0A0A] text-white">Contratto</option>
              <option value="DOCUMENTO" className="bg-[#0A0A0A] text-white">Documento HR</option>
            </select>
          </div>

          {/* Year Chips */}
          {yearsList.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedYear("ALL")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-extrabold transition shrink-0",
                  selectedYear === "ALL"
                    ? "bg-[#B85B68] text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                Tutti gli anni
              </button>
              {yearsList.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(String(y))}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-extrabold transition shrink-0",
                    selectedYear === String(y)
                      ? "bg-[#B85B68] text-white"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                {y}
              </button>
              ))}
            </div>
          )}
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="border border-white/5 bg-white/5 py-12 text-center text-sm text-white/45 rounded-[24px]">
            Nessun documento corrispondente ai filtri.
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
                isExpanded ? "flex flex-col gap-4 animate-in fade-in-50 duration-200" : "h-[72px] flex items-center justify-between"
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
                      {!employeeView && (
                        <p className="flex items-center gap-2">
                          <span className="opacity-60">Collaboratore:</span>
                          <span>{doc.user.name}</span>
                        </p>
                      )}
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
                  <div
                    className={cn(
                      "size-9 rounded-full flex items-center justify-center shadow-sm shrink-0",
                      color.arrowBg,
                      color.arrowText
                    )}
                  >
                    <ArrowUpRight className="size-4" />
                  </div>
                </>
              )}
            </div>
          );
        }))}
      </div>

      <div className="hidden grid-cols-12 gap-5 lg:grid">
        <Card className="col-span-5 max-h-[calc(100dvh-8rem)] overflow-hidden p-0 hover:translate-y-0 flex flex-col">
          <div className="border-b border-black/5 bg-white/80 p-5 shrink-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-black/35">Archivio documenti</p>
            <h2 className="mt-1 text-xl font-extrabold text-paradise-noir">
              {filteredDocuments.length === documents.length
                ? `${documents.length} file disponibili`
                : `${filteredDocuments.length} di ${documents.length} file`}
            </h2>
          </div>

          {/* Desktop Filters Panel */}
          <div className="border-b border-black/5 bg-slate-50/50 p-4 space-y-3 shrink-0">
            {/* Search bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Cerca per titolo o collaboratore..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-black/10 bg-white text-xs font-semibold outline-none focus:border-[#B85B68] focus:ring-1 focus:ring-[#B85B68]/30 transition"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/30" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-black/30 hover:text-black/60">
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Employee Filter */}
              {!employeeView && (
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="h-9 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-black/[0.01]"
                >
                  <option value="">Tutti i dipendenti</option>
                  {workersList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Document Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className={cn(
                  "h-9 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold outline-none cursor-pointer hover:bg-black/[0.01]",
                  employeeView && "col-span-2"
                )}
              >
                <option value="ALL">Tutti i tipi</option>
                <option value="BUSTA_PAGA">Busta paga</option>
                <option value="CONTRATTO">Contratto</option>
                <option value="DOCUMENTO">Documento HR</option>
              </select>
            </div>

            {/* Year Chips */}
            {yearsList.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedYear("ALL")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-extrabold transition shrink-0",
                    selectedYear === "ALL"
                      ? "bg-[#B85B68] text-white"
                      : "bg-white border border-black/5 text-black/55 hover:bg-black/[0.02]"
                  )}
                >
                  Tutti gli anni
                </button>
                {yearsList.map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(String(y))}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-extrabold transition shrink-0",
                      selectedYear === String(y)
                        ? "bg-[#B85B68] text-white"
                        : "bg-white border border-black/5 text-black/55 hover:bg-black/[0.02]"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0">
            {filteredDocuments.length === 0 ? (
              <div className="border border-black/5 bg-white/70 py-12 text-center text-sm text-black/45 rounded-3xl">
                Nessun documento corrispondente ai filtri.
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
        </Card>

        <div className="col-span-7 min-w-0">{selectedDocument ? <DesktopPreview document={selectedDocument} employeeView={employeeView} onDelete={handleDelete} deletingId={deletingId} /> : null}</div>
      </div>

      {mobilePreview ? <MobilePreviewModal document={mobilePreview} employeeView={employeeView} onClose={() => setMobilePreview(null)} /> : null}
    </>
  );
}
