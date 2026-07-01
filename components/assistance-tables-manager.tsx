"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import type {
  AssistanceAttachment,
  AssistanceCellValue,
  AssistanceColumnType,
  AssistanceSheet,
  AssistanceTableColumn,
  AssistanceTableRow,
} from "@/lib/assistance-tables";
import { Button, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type RowForm = {
  nome: string;
  cognome: string;
  testo: string;
  image: AssistanceAttachment | null;
  file: AssistanceAttachment | null;
  values: Record<string, AssistanceCellValue>;
};

const emptyForm: RowForm = {
  nome: "",
  cognome: "",
  testo: "",
  image: null,
  file: null,
  values: {},
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function fileToAttachment(file: File): Promise<AssistanceAttachment> {
  return new Promise((resolve, reject) => {
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error("File massimo 3 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, url: String(reader.result ?? "") });
    reader.onerror = () => reject(new Error("File non leggibile"));
    reader.readAsDataURL(file);
  });
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function detailDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isAttachment(value: AssistanceCellValue): value is AssistanceAttachment {
  return Boolean(value && typeof value === "object" && "url" in value && "name" in value);
}

function cellSearchText(value: AssistanceCellValue) {
  if (isAttachment(value)) return value.name;
  return typeof value === "string" ? value : "";
}

function hasCellValue(value: AssistanceCellValue) {
  if (isAttachment(value)) return Boolean(value.url);
  return typeof value === "string" ? Boolean(value.trim()) : false;
}

function cleanCellValue(value: AssistanceCellValue): AssistanceCellValue {
  if (isAttachment(value)) return value;
  return typeof value === "string" ? value.trim() : "";
}

function columnTypeLabel(type: AssistanceColumnType) {
  if (type === "image") return "Immagine";
  if (type === "file") return "File";
  return "Testo";
}

function renderCellValue(value: AssistanceCellValue, column: AssistanceTableColumn) {
  if (isAttachment(value)) {
    if (column.type === "image") {
      return (
        <a href={value.url} download={value.name} className="inline-flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <img src={value.url} alt={value.name} className="size-12 rounded-xl object-cover ring-1 ring-black/10" />
          <span className="max-w-[140px] truncate text-xs font-bold text-[#B85B68]">{value.name}</span>
        </a>
      );
    }
    return (
      <a href={value.url} download={value.name} className="inline-flex max-w-[180px] items-center gap-2 rounded-full bg-paradise-softPink/45 px-3 py-1 text-xs font-bold text-[#B85B68]" onClick={(event) => event.stopPropagation()}>
        <Download className="size-3.5 shrink-0" />
        <span className="truncate">{value.name}</span>
      </a>
    );
  }
  return <span className="line-clamp-2 whitespace-pre-wrap break-words text-black/65 dark:text-white/65">{value || "-"}</span>;
}

export function AssistanceTablesManager({ initialSheets }: { initialSheets: AssistanceSheet[] }) {
  const [sheets, setSheets] = useState<AssistanceSheet[]>(initialSheets);
  const [openedSheetId, setOpenedSheetId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [columnFilter, setColumnFilter] = useState("all");
  const [sheetName, setSheetName] = useState("");
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<AssistanceColumnType>("text");
  const [form, setForm] = useState<RowForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [message, setMessage] = useState("Salvato");
  const [isPending, startTransition] = useTransition();

  const activeSheet = sheets.find((sheet) => sheet.id === openedSheetId) ?? null;
  const selectedRow = activeSheet?.rows.find((row) => row.id === selectedRowId) ?? null;
  const selectedRowTitle = selectedRow
    ? activeSheet?.columns.map((column) => cellSearchText(selectedRow.values?.[column.id] ?? "")).find(Boolean) || "Dettaglio riga"
    : "";

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = activeSheet?.rows ?? [];
    if (!term) return rows;
    return rows.filter((row) => {
      if (columnFilter.startsWith("custom:")) {
        return cellSearchText(row.values?.[columnFilter.replace("custom:", "")] ?? "").toLowerCase().includes(term);
      }
      return [
        row.nome,
        row.cognome,
        row.testo,
        ...Object.values(row.values ?? {}).map(cellSearchText),
        row.image?.name ?? "",
        row.file?.name ?? "",
      ].join(" ").toLowerCase().includes(term);
    });
  }, [activeSheet?.rows, columnFilter, query]);

  function persist(nextSheets: AssistanceSheet[]) {
    setSheets(nextSheets);
    setMessage("Salvataggio...");
    startTransition(async () => {
      try {
        const response = await fetch("/api/tables", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheets: nextSheets }),
        });
        if (!response.ok) throw new Error("Errore");
        setMessage("Salvato");
      } catch (error) {
        setMessage("Errore salvataggio");
      }
    });
  }

  function createSheet() {
    const name = sheetName.trim() || `Sheet ${sheets.length + 1}`;
    const createdAt = now();
    const sheet: AssistanceSheet = { id: uid(), name, columns: [], rows: [], createdAt, updatedAt: createdAt };
    persist([...sheets, sheet]);
    setOpenedSheetId(sheet.id);
    setSheetName("");
  }

  function renameActiveSheet(name: string) {
    if (!activeSheet) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    persist(sheets.map((sheet) => sheet.id === activeSheet.id ? { ...sheet, name: cleanName, updatedAt: now() } : sheet));
  }

  function addColumn() {
    if (!activeSheet) return;
    const label = columnName.trim();
    if (!label) return;
    const timestamp = now();
    persist(sheets.map((sheet) => sheet.id === activeSheet.id
      ? { ...sheet, columns: [...(sheet.columns ?? []), { id: uid(), label, type: columnType }], updatedAt: timestamp }
      : sheet
    ));
    setColumnName("");
    setColumnType("text");
  }

  function deleteColumn(columnId: string) {
    if (!activeSheet) return;
    const timestamp = now();
    persist(sheets.map((sheet) => {
      if (sheet.id !== activeSheet.id) return sheet;
      return {
        ...sheet,
        columns: (sheet.columns ?? []).filter((column) => column.id !== columnId),
        rows: sheet.rows.map((row) => {
          const nextValues = { ...(row.values ?? {}) };
          delete nextValues[columnId];
          return { ...row, values: nextValues, updatedAt: timestamp };
        }),
        updatedAt: timestamp,
      };
    }));
  }

  function deleteActiveSheet() {
    if (!activeSheet || sheets.length <= 1) return;
    const next = sheets.filter((sheet) => sheet.id !== activeSheet.id);
    persist(next);
    setOpenedSheetId(null);
    setSelectedRowId(null);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  }

  function openNewRowForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(true);
  }

  function saveRow() {
    if (!activeSheet) return;
    const cleanForm = {
      ...form,
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      testo: form.testo.trim(),
      values: Object.fromEntries(Object.entries(form.values).map(([key, value]) => [key, cleanCellValue(value)])),
    };
    if (!cleanForm.nome && !cleanForm.cognome && !cleanForm.testo && !Object.values(cleanForm.values).some(hasCellValue) && !cleanForm.image && !cleanForm.file) return;

    const timestamp = now();
    const newId = uid();
    const rows = editingId
      ? activeSheet.rows.map((row) => row.id === editingId ? { ...row, ...cleanForm, updatedAt: timestamp } : row)
      : [
          {
            id: newId,
            ...cleanForm,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...activeSheet.rows,
        ];

    persist(sheets.map((sheet) => sheet.id === activeSheet.id ? { ...sheet, rows, updatedAt: timestamp } : sheet));
    setSelectedRowId(editingId ?? newId);
    resetForm();
  }

  function editRow(row: AssistanceTableRow) {
    setEditingId(row.id);
    setSelectedRowId(null);
    setForm({
      nome: row.nome,
      cognome: row.cognome,
      testo: row.testo,
      image: row.image,
      file: row.file,
      values: row.values ?? {},
    });
    setFormOpen(true);
  }

  function deleteRow(rowId: string) {
    if (!activeSheet) return;
    const timestamp = now();
    persist(sheets.map((sheet) => sheet.id === activeSheet.id
      ? { ...sheet, rows: sheet.rows.filter((row) => row.id !== rowId), updatedAt: timestamp }
      : sheet
    ));
    if (selectedRowId === rowId) setSelectedRowId(null);
    if (editingId === rowId) resetForm();
  }

  async function attachCellFile(columnId: string, file: File | undefined) {
    if (!file) return;
    try {
      const attachment = await fileToAttachment(file);
      setForm((current) => ({ ...current, values: { ...current.values, [columnId]: attachment } }));
      setMessage("File pronto, salva la riga");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "File non valido");
    }
  }

  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);

  if (!activeSheet) {
    return (
      <div className="space-y-6">
        <div className="rounded-[26px] border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#B85B68]">Workbook</p>
              <h2 className="mt-2 text-3xl font-black">Le tue tabelle</h2>
              <p className="mt-2 text-sm text-black/50 dark:text-white/50">Scegli una sheet per entrare nella tabella completa.</p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Field
                value={sheetName}
                onChange={(event) => setSheetName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createSheet();
                }}
                placeholder="Nome nuova sheet"
                className="border-paradise-pink/30 bg-paradise-softPink/15 sm:w-72"
              />
              <Button type="button" onClick={createSheet} className="bg-paradise-pink text-paradise-noir">
                <Plus className="size-4" />
                Nuova sheet
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sheets.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => {
                setOpenedSheetId(sheet.id);
                setQuery("");
                setSelectedRowId(null);
              }}
              className="group rounded-[24px] border border-black/5 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-paradise-pink/40 hover:shadow-[0_24px_60px_rgba(255,168,221,0.28)] dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-paradise-softPink/40 text-[#B85B68] transition group-hover:bg-paradise-pink group-hover:text-paradise-noir">
                  <Table2 className="size-6" />
                </div>
                <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-black text-black/45 dark:bg-white/10 dark:text-white/45">
                  {sheet.rows.length} righe
                </span>
              </div>
              <h3 className="mt-5 truncate text-2xl font-black">{sheet.name}</h3>
              <p className="mt-2 text-sm text-black/45 dark:text-white/45">Aggiornata {compactDate(sheet.updatedAt)}</p>
              <div className="mt-6 flex items-center justify-between border-t border-black/5 pt-4 text-sm font-bold text-[#B85B68] dark:border-white/10">
                Apri tabella
                <span className="text-xl transition group-hover:translate-x-1">→</span>
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] bg-paradise-pink p-5 text-paradise-noir">
            <p className="text-3xl font-black">{sheets.length}</p>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Sheet totali</p>
          </div>
          <div className="rounded-[22px] bg-paradise-softPink p-5 text-paradise-noir">
            <p className="text-3xl font-black">{totalRows}</p>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-black/45">Righe totali</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => {
                setOpenedSheetId(null);
                setSelectedRowId(null);
                resetForm();
              }}
              className="grid size-11 shrink-0 place-items-center rounded-2xl border border-black/5 bg-white text-black/60 shadow-sm transition hover:bg-paradise-softPink/45 hover:text-[#B85B68] dark:border-white/10 dark:bg-white/10 dark:text-white/70"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#B85B68]">Sheet aperta</p>
              <input
                value={activeSheet.name}
                onChange={(event) => {
                  setSheets((current) => current.map((sheet) => sheet.id === activeSheet.id ? { ...sheet, name: event.target.value } : sheet));
                }}
                onBlur={(event) => renameActiveSheet(event.target.value)}
                className="mt-1 w-full bg-transparent text-3xl font-black outline-none"
              />
              <p className="mt-1 text-xs font-semibold text-black/40 dark:text-white/40">
                {filteredRows.length} visibili su {activeSheet.rows.length} · {isPending ? "Salvataggio..." : message}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={openNewRowForm} className="bg-paradise-pink text-paradise-noir">
              <Plus className="size-4" />
              Nuova riga
            </Button>
            <Button type="button" variant="soft" onClick={deleteActiveSheet} disabled={sheets.length <= 1}>
              <Trash2 className="size-4" />
              Elimina sheet
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_220px_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-xs font-black text-black/55 dark:text-white/55">Cerca nella tabella</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/35" />
              <Field className="pl-10" placeholder="Cerca nelle colonne della sheet..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-black text-black/55 dark:text-white/55">Colonna</label>
            <select
              value={columnFilter}
              onChange={(event) => setColumnFilter(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none focus:border-paradise-pink dark:border-white/10 dark:bg-black/20"
            >
              <option value="all">Tutte</option>
              {(activeSheet.columns ?? []).map((column) => (
                <option key={column.id} value={`custom:${column.id}`}>{column.label}</option>
              ))}
            </select>
          </div>
          <Button type="button" className="bg-paradise-pink text-paradise-noir" onClick={() => setQuery(query.trim())}>
            Search
          </Button>
        </div>
        <div className="mt-4 grid gap-2 border-t border-black/5 pt-4 dark:border-white/10 md:grid-cols-[1fr_180px_auto]">
          <Field
            value={columnName}
            onChange={(event) => setColumnName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addColumn();
            }}
            placeholder="Nome colonna: Cliente, Telefono, Foto, Contratto..."
          />
          <Select value={columnType} onChange={(event) => setColumnType(event.target.value as AssistanceColumnType)}>
            <option value="text">Testo</option>
            <option value="image">Immagine</option>
            <option value="file">File</option>
          </Select>
          <Button type="button" variant="soft" onClick={addColumn} className="shrink-0">
            <Plus className="size-4" />
            Aggiungi colonna
          </Button>
        </div>
        {(activeSheet.columns ?? []).length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeSheet.columns.map((column) => (
              <span key={column.id} className="inline-flex items-center gap-2 rounded-full bg-paradise-softPink/45 px-3 py-1.5 text-xs font-bold text-[#B85B68]">
                {column.label}
                <span className="rounded-full bg-white/65 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-black/45">{columnTypeLabel(column.type)}</span>
                <button type="button" onClick={() => deleteColumn(column.id)} className="text-[#B85B68]/60 hover:text-red-600">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#101014]">
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#f3f6ff] text-[11px] font-black uppercase tracking-[0.12em] text-white">
                <th className="sticky left-0 z-10 border border-white/70 bg-[#B85B68] px-3 py-3 text-center dark:border-white/10">#</th>
                {(activeSheet.columns ?? []).map((column, index) => (
                  <th key={column.id} className={cn("border border-white/70 px-3 py-3 dark:border-white/10", index % 3 === 0 && "bg-[#B85B68]", index % 3 === 1 && "bg-paradise-pink text-paradise-noir", index % 3 === 2 && "bg-[#E0529C]")}>
                    {column.label}
                  </th>
                ))}
                <th className="border border-white/70 bg-[#B85B68] px-3 py-3 dark:border-white/10">Creato</th>
                <th className="border border-white/70 bg-paradise-pink px-3 py-3 text-paradise-noir dark:border-white/10">Aggiornato</th>
                <th className="border border-white/70 bg-[#B85B68] px-3 py-3 text-right dark:border-white/10">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? filteredRows.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRowId(row.id)}
                  className={cn(
                    "cursor-pointer transition hover:bg-[#fff7e8] dark:hover:bg-white/5",
                    selectedRowId === row.id && "bg-paradise-softPink/25 dark:bg-white/10"
                  )}
                >
                  <td className="sticky left-0 z-10 border border-black/10 bg-white px-3 py-2 text-center font-mono text-xs font-bold text-black/45 dark:border-white/10 dark:bg-[#101014] dark:text-white/45">{index + 1}</td>
                  {(activeSheet.columns ?? []).map((column) => (
                    <td key={column.id} className="min-w-[180px] border border-black/10 px-3 py-2 dark:border-white/10">
                      {renderCellValue(row.values?.[column.id] ?? "", column)}
                    </td>
                  ))}
                  <td className="border border-black/10 px-3 py-2 text-xs text-black/50 dark:border-white/10 dark:text-white/50">{compactDate(row.createdAt)}</td>
                  <td className="border border-black/10 px-3 py-2 text-xs text-black/50 dark:border-white/10 dark:text-white/50">{compactDate(row.updatedAt)}</td>
                  <td className="border border-black/10 px-3 py-2 dark:border-white/10">
                    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => setSelectedRowId(row.id)} className="grid size-9 place-items-center rounded-full bg-black/5 text-black/55 hover:bg-paradise-pink hover:text-paradise-noir">
                        <Eye className="size-4" />
                      </button>
                      <button type="button" onClick={() => editRow(row)} className="grid size-9 place-items-center rounded-full bg-paradise-pink/15 text-[#B85B68] hover:bg-paradise-pink/25">
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" onClick={() => deleteRow(row.id)} className="grid size-9 place-items-center rounded-full bg-black/5 text-black/45 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4 + (activeSheet.columns ?? []).length} className="px-6 py-16 text-center">
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-paradise-softPink/45 text-[#B85B68]">
                      <Table2 className="size-6" />
                    </div>
                    <p className="mt-4 font-black">Nessuna riga ancora</p>
                    <p className="mt-1 text-sm text-black/45">
                      {(activeSheet.columns ?? []).length ? "Premi “Nuova riga” per aggiungere dati." : "Crea prima le colonne della sheet, poi aggiungi le righe."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(formOpen || selectedRow) ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm" onMouseDown={() => selectedRow ? setSelectedRowId(null) : resetForm()}>
          <div className="w-full max-w-2xl rounded-[26px] bg-white p-5 shadow-2xl dark:bg-[#17171d]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-4 dark:border-white/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B85B68]">{selectedRow ? "Dettaglio riga" : editingId ? "Modifica riga" : "Nuova riga"}</p>
                <h3 className="mt-1 text-2xl font-black">
                  {selectedRow ? selectedRowTitle : editingId ? "Modifica record" : "Aggiungi record"}
                </h3>
              </div>
              <button type="button" onClick={() => selectedRow ? setSelectedRowId(null) : resetForm()} className="grid size-10 place-items-center rounded-full bg-black/5 text-black/45">
                <X className="size-5" />
              </button>
            </div>

            {selectedRow ? (
              <div className="mt-5 space-y-4">
                {(activeSheet.columns ?? []).length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeSheet.columns.map((column) => (
                      <div key={column.id} className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-black/35">{column.label}</p>
                        <div className="mt-2 text-sm font-semibold">{renderCellValue(selectedRow.values?.[column.id] ?? "", column)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 p-5 text-sm font-semibold text-black/45 dark:border-white/10 dark:text-white/45">
                    Questa sheet non ha ancora colonne.
                  </div>
                )}
                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5">
                    <p className="font-black uppercase tracking-[0.12em] text-black/35">Creato</p>
                    <p className="mt-1 font-bold">{detailDate(selectedRow.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5">
                    <p className="font-black uppercase tracking-[0.12em] text-black/35">Aggiornato</p>
                    <p className="mt-1 font-bold">{detailDate(selectedRow.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="soft" className="flex-1" onClick={() => editRow(selectedRow)}>
                    <Pencil className="size-4" />
                    Modifica
                  </Button>
                  <Button type="button" variant="soft" className="flex-1 text-red-600" onClick={() => deleteRow(selectedRow.id)}>
                    <Trash2 className="size-4" />
                    Elimina
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {(activeSheet.columns ?? []).length ? activeSheet.columns.map((column) => {
                  const value = form.values[column.id] ?? "";
                  if (column.type === "text") {
                    return (
                      <Field
                        key={column.id}
                        placeholder={column.label}
                        value={typeof value === "string" ? value : cellSearchText(value)}
                        onChange={(event) => setForm((current) => ({ ...current, values: { ...current.values, [column.id]: event.target.value } }))}
                      />
                    );
                  }
                  const acceptedType = column.type === "image" ? "image/*" : undefined;
                  return (
                    <div key={column.id} className="rounded-2xl border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-black/45 dark:text-white/45">{column.label}</p>
                      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-paradise-softPink/45 px-4 py-2.5 text-sm font-bold text-[#B85B68] transition hover:bg-paradise-softPink">
                        {column.type === "image" ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
                        Carica {columnTypeLabel(column.type).toLowerCase()}
                        <input type="file" accept={acceptedType} className="hidden" onChange={(event) => attachCellFile(column.id, event.target.files?.[0])} />
                      </label>
                      {isAttachment(value) ? (
                        <div className="mt-3">
                          {column.type === "image" ? (
                            <img src={value.url} alt={value.name} className="max-h-36 rounded-2xl object-cover ring-1 ring-black/10" />
                          ) : null}
                          <p className="mt-2 truncate text-xs font-semibold text-black/55 dark:text-white/55">{value.name}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-black/10 p-5 text-sm font-semibold text-black/45 dark:border-white/10 dark:text-white/45">
                    Prima crea almeno una colonna nella sheet.
                  </div>
                )}
                <Button type="button" onClick={saveRow} className="mt-2 w-full bg-paradise-pink text-paradise-noir">
                  {editingId ? "Salva modifica" : "Aggiungi riga"}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
