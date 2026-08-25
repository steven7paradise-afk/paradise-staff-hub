"use client";

import { FormEvent, useMemo, useState } from "react";
import { Download, ExternalLink, Eye, FileCheck2, FileText, Upload, X } from "lucide-react";
import { Field, Select } from "@/components/ui";

export type EmployeeContractDocument = {
  id: string;
  title: string;
  type: string;
  fileUrl: string;
  storagePath: string | null;
  documentDate: string;
  createdAt: string;
};

const GROUPS = [
  { key: "CONTRATTO", label: "Contratti" },
  { key: "RINNOVO", label: "Rinnovi" },
  { key: "CUD", label: "CUD / CU" },
] as const;

function documentGroup(document: EmployeeContractDocument) {
  const text = `${document.type} ${document.title}`.toLowerCase();
  if (/rinnovo|proroga/.test(text)) return "RINNOVO";
  if (/\bcud\b|certificazione unica|\bcu\b/.test(text)) return "CUD";
  if (/contratto/.test(text)) return "CONTRATTO";
  return "ALTRO";
}

function formatDate(value: string) {
  if (!value) return "Data non indicata";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("it-IT").format(date);
}

export function EmployeeContractDocuments({
  employeeId,
  employeeName,
  documents,
  onUploaded,
}: {
  employeeId: string;
  employeeName: string;
  documents: EmployeeContractDocument[];
  onUploaded: (document: EmployeeContractDocument) => void;
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<EmployeeContractDocument | null>(null);
  const grouped = useMemo(() => {
    const map = new Map<string, EmployeeContractDocument[]>();
    documents.forEach((document) => {
      const key = documentGroup(document);
      map.set(key, [...(map.get(key) ?? []), document]);
    });
    return map;
  }, [documents]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setStatus("");
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set("userId", employeeId);

    try {
      const response = await fetch("/api/documents", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Caricamento non riuscito.");
      onUploaded({
        id: data.id,
        title: data.title,
        type: data.type,
        fileUrl: data.file_url,
        storagePath: data.storage_path ?? null,
        documentDate: data.document_date ? String(data.document_date).slice(0, 10) : "",
        createdAt: data.created_at,
      });
      form.reset();
      setShowUpload(false);
      setStatus("Documento caricato e collegato alla dipendente.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Caricamento non riuscito.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-[28px] border border-[#F4E3EA] p-6 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-black/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
            <FileCheck2 className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Contratti e documenti fiscali</h2>
            <p className="text-[10px] font-semibold text-neutral-400">Scorciatoie documenti di {employeeName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((value) => !value)}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#D96B94] px-4 text-xs font-bold text-white transition hover:bg-[#C85982]"
        >
          <Upload className="size-4" />
          Carica documento
        </button>
      </div>

      {status ? <p className="mt-3 rounded-2xl bg-[#FFF8FC] px-4 py-3 text-xs font-bold text-[#B83D7F]">{status}</p> : null}

      {showUpload ? (
        <form onSubmit={upload} className="mt-4 grid gap-3 rounded-[22px] border border-[#F3B5D4] bg-[#FFF8FC] p-4 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Tipo documento</span>
            <Select name="type" defaultValue="CONTRATTO" required>
              <option value="CONTRATTO">Contratto</option>
              <option value="RINNOVO">Rinnovo / proroga</option>
              <option value="CUD">CUD / Certificazione Unica</option>
              <option value="DOCUMENTO">Altro documento HR</option>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Titolo</span>
            <Field name="title" placeholder="Contratto, rinnovo, CUD..." required />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data documento</span>
            <Field name="documentDate" type="date" required />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">File PDF</span>
            <input name="file" type="file" accept="application/pdf,.pdf" required className="block min-h-11 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[#FCE5F3] file:px-3 file:py-1 file:font-bold file:text-[#B83D7F]" />
          </label>
          <div className="flex justify-end gap-2 md:col-span-4">
            <button type="button" onClick={() => setShowUpload(false)} className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-bold text-neutral-600">Annulla</button>
            <button disabled={uploading} className="rounded-2xl bg-[#D96B94] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{uploading ? "Caricamento..." : "Carica e collega"}</button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {GROUPS.map((group) => {
          const items = grouped.get(group.key) ?? [];
          return (
            <section key={group.key} className="rounded-[22px] border border-[#F4E3EA] bg-[#FCFAFB] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700">{group.label}</h3>
                <span className="rounded-full bg-[#FCE5F3] px-2 py-1 text-[10px] font-black text-[#B83D7F]">{items.length}</span>
              </div>
              <div className="mt-3 space-y-3">
                {items.length ? items.map((document) => {
                  const url = `/api/documents/${document.id}/download`;
                  return (
                    <article key={document.id} className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 size-4 shrink-0 text-[#D96B94]" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-neutral-900">{document.title}</p>
                          <p className="mt-1 text-[10px] font-semibold text-neutral-400">{formatDate(document.documentDate)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setPreview(document)} className="inline-flex items-center gap-1 rounded-xl bg-[#FFF0F7] px-2.5 py-1.5 text-[10px] font-bold text-[#B83D7F]"><Eye className="size-3" />Vedi</button>
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-[10px] font-bold text-neutral-600"><ExternalLink className="size-3" />Apri PDF</a>
                        <a href={`${url}?download=1`} className="inline-flex items-center gap-1 rounded-xl bg-[#D96B94] px-2.5 py-1.5 text-[10px] font-bold text-white"><Download className="size-3" />Scarica PDF</a>
                      </div>
                    </article>
                  );
                }) : <p className="rounded-2xl border border-dashed border-black/10 p-4 text-center text-[11px] font-semibold text-neutral-400">Nessun documento trovato.</p>}
              </div>
            </section>
          );
        })}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Anteprima ${preview.title}`}>
          <div className="flex h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-black/5 p-4">
              <div><p className="text-xs font-black text-neutral-900">{preview.title}</p><p className="text-[10px] text-neutral-400">{formatDate(preview.documentDate)}</p></div>
              <button type="button" onClick={() => setPreview(null)} className="grid size-10 place-items-center rounded-full bg-neutral-100" aria-label="Chiudi anteprima"><X className="size-4" /></button>
            </header>
            <iframe title={`Anteprima ${preview.title}`} src={`/api/documents/${preview.id}/download#toolbar=1&view=FitH`} className="min-h-0 flex-1 bg-neutral-100" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
