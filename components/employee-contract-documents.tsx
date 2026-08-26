"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Download, ExternalLink, Eye, FileCheck2, FileText, Pencil, Upload, X } from "lucide-react";
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
  { key: "CONTRATTI_RINNOVI", label: "Contratti e rinnovi" },
  { key: "BUSTA_PAGA", label: "Cedolini / buste paga" },
  { key: "CUD", label: "CUD / CU" },
] as const;

function documentGroup(document: EmployeeContractDocument) {
  const text = `${document.type} ${document.title}`.toLowerCase();
  if (/contratto|rinnovo|proroga/.test(text)) return "CONTRATTI_RINNOVI";
  if (/busta.?paga|cedolino/.test(text)) return "BUSTA_PAGA";
  if (/\bcud\b|certificazione unica|\bcu\b/.test(text)) return "CUD";
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
  onUpdated,
  embedded = false,
}: {
  employeeId: string;
  employeeName: string;
  documents: EmployeeContractDocument[];
  onUploaded: (document: EmployeeContractDocument) => void;
  onUpdated: (document: EmployeeContractDocument) => void;
  embedded?: boolean;
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<EmployeeContractDocument | null>(null);
  const [editing, setEditing] = useState<EmployeeContractDocument | null>(null);
  const [saving, setSaving] = useState(false);
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

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setStatus("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/documents/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.get("title"),
          type: values.get("type"),
          documentDate: values.get("documentDate"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Modifica non riuscita.");
      onUpdated({
        ...editing,
        title: data.title,
        type: data.type,
        documentDate: data.document_date ? String(data.document_date).slice(0, 10) : "",
      });
      setEditing(null);
      setStatus("Documento aggiornato.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Modifica non riuscita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={embedded
      ? "mt-5 border-t border-black/5 pt-5"
      : "rounded-[22px] border border-[#F4E3EA] bg-white p-4 shadow-[0_10px_30px_rgba(104,62,79,0.05)] sm:p-5"
    }>
      <div className="flex flex-col gap-3 border-b border-black/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {!embedded ? (
            <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
              <FileCheck2 className="size-4" />
            </div>
          ) : null}
          <div>
            {embedded ? (
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1F1F1F]">Documenti collegati</h3>
            ) : (
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Contratti e documenti fiscali</h2>
            )}
            <p className="text-[10px] font-semibold text-neutral-400">Contratti, rinnovi, cedolini e CUD recuperati dall'archivio Cedolini di {employeeName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/cedolini?employee=${encodeURIComponent(employeeId)}`}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-[#D96B94] bg-white px-4 text-xs font-bold text-[#B83D7F]"
          >
            <ExternalLink className="size-4" />
            Apri archivio Cedolini
          </Link>
          <button
            type="button"
            onClick={() => setShowUpload((value) => !value)}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#D96B94] px-4 text-xs font-bold text-white transition hover:bg-[#C85982]"
          >
            <Upload className="size-4" />
            Carica in Cedolini
          </button>
        </div>
      </div>

      {status ? <p className="mt-3 rounded-2xl bg-[#FFF8FC] px-4 py-3 text-xs font-bold text-[#B83D7F]">{status}</p> : null}

      {showUpload ? (
        <form onSubmit={upload} className="mt-4 grid gap-3 rounded-[22px] border border-[#F3B5D4] bg-[#FFF8FC] p-4 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Tipo documento</span>
            <Select name="type" defaultValue="CONTRATTO" required>
              <option value="CONTRATTO">Contratto</option>
              <option value="PROROGA">Proroga / rinnovo</option>
              <option value="BUSTA_PAGA">Cedolino / busta paga</option>
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

      {editing ? (
        <form onSubmit={saveEdit} className="mt-4 grid gap-3 rounded-[22px] border border-[#D96B94] bg-[#FFF8FC] p-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Tipo documento</span>
            <Select name="type" defaultValue={editing.type} required>
              <option value="CONTRATTO">Contratto</option>
              <option value="PROROGA">Proroga / rinnovo</option>
              <option value="BUSTA_PAGA">Cedolino / busta paga</option>
              <option value="CUD">CUD / Certificazione Unica</option>
              <option value="DOCUMENTO">Altro documento HR</option>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Titolo</span>
            <Field name="title" defaultValue={editing.title} required />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data documento</span>
            <Field name="documentDate" type="date" defaultValue={editing.documentDate} />
          </label>
          <div className="flex justify-end gap-2 md:col-span-3">
            <button type="button" onClick={() => setEditing(null)} className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-bold text-neutral-600">Annulla</button>
            <button disabled={saving} className="rounded-2xl bg-[#D96B94] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Salvataggio..." : "Salva modifiche"}</button>
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
                        <button type="button" onClick={() => setEditing(document)} className="inline-flex items-center gap-1 rounded-xl border border-[#F3B5D4] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#B83D7F]"><Pencil className="size-3" />Modifica</button>
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

      {preview ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Anteprima ${preview.title}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <div className="flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:h-[calc(100dvh-3rem)] sm:rounded-[28px]">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-black/10 bg-white px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-neutral-900">{preview.title}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-neutral-400">{formatDate(preview.documentDate)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/api/documents/${preview.id}/download?download=1`}
                  className="hidden min-h-10 items-center gap-2 rounded-full bg-[#D96B94] px-4 text-xs font-bold text-white sm:inline-flex"
                >
                  <Download className="size-4" />
                  Scarica PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="grid size-10 place-items-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200"
                  aria-label="Chiudi anteprima"
                >
                  <X className="size-5" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 bg-neutral-200 p-2 sm:p-3">
              <iframe
                title={`Anteprima ${preview.title}`}
                src={`/api/documents/${preview.id}/download#toolbar=1&navpanes=0&view=FitH`}
                className="h-full w-full rounded-xl border-0 bg-white"
              />
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
