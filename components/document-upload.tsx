"use client";

import { FormEvent, useState, useEffect } from "react";
import { Upload, X, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type Worker = { id: string; name: string };

type BulkFileItem = {
  id: string;
  file: File;
  userId: string;
  title: string;
  type: string;
  month: string;
  year: string;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
};

export function DocumentUpload({ workers }: { workers: Worker[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("single");
  const [bulkFiles, setBulkFiles] = useState<BulkFileItem[]>([]);

  // Reset bulk list when modal closes
  useEffect(() => {
    if (!open) {
      setBulkFiles([]);
      setStatus("");
      setUploadMode("single");
    }
  }, [open]);

  // Single document upload form submit
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/documents", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setStatus(result.error ?? "Documento non caricato.");
    setOpen(false);
    setStatus("Documento caricato e notifica inviata al dipendente.");
    router.refresh();
  }

  // Automatic filename parser
  function parseFilename(filename: string, workers: Worker[]) {
    const cleanName = filename.toLowerCase().replace(/[_\-\.]/g, " ");
    
    // 1. Match employee
    let bestWorkerId = "";
    let bestScore = 0;
    
    workers.forEach(w => {
      const wNameWords = w.name.toLowerCase().split(/\s+/).filter(Boolean);
      let score = 0;
      wNameWords.forEach(word => {
        if (cleanName.includes(word)) {
          score += 1;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        bestWorkerId = w.id;
      }
    });

    // 2. Match month
    const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
    let detectedMonth = "";
    for (let i = 0; i < months.length; i++) {
      if (cleanName.includes(months[i])) {
        detectedMonth = String(i + 1);
        break;
      }
    }

    // 3. Match year
    const yearMatch = cleanName.match(/\b(20\d{2})\b/);
    const detectedYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

    // 4. Match type
    let detectedType = "BUSTA_PAGA";
    if (cleanName.includes("contratto")) {
      detectedType = "CONTRATTO";
    } else if (cleanName.includes("cu ") || cleanName.includes("cu_") || cleanName.includes("cu-") || cleanName.includes("certificazione")) {
      detectedType = "DOCUMENTO";
    }

    // 5. Generate title
    const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const title = baseName
      .replace(/[_\-]/g, " ")
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return {
      userId: bestWorkerId,
      title,
      type: detectedType,
      month: detectedMonth,
      year: detectedYear,
    };
  }

  // Handle multi-file selection
  const handleBulkFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const newItems = files.map(file => {
      const parsed = parseFilename(file.name, workers);
      return {
        id: Math.random().toString(36).substring(7),
        file,
        userId: parsed.userId,
        title: parsed.title,
        type: parsed.type,
        month: parsed.month,
        year: parsed.year,
        status: "idle" as const
      };
    });
    
    setBulkFiles(prev => [...prev, ...newItems]);
    e.target.value = ""; // Reset input so same file can be selected again
  };

  // Perform bulk upload
  const startBulkUpload = async () => {
    setLoading(true);
    setStatus("");
    
    const items = [...bulkFiles];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === "success") continue;
      
      // Mark as uploading
      setBulkFiles(prev => prev.map(p => p.id === item.id ? { ...p, status: "uploading" } : p));
      
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("userId", item.userId);
        formData.append("title", item.title);
        formData.append("type", item.type);
        if (item.month) formData.append("month", item.month);
        if (item.year) formData.append("year", item.year);
        
        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData
        });
        
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Errore di caricamento");
        }
        
        setBulkFiles(prev => prev.map(p => p.id === item.id ? { ...p, status: "success" } : p));
      } catch (err: any) {
        setBulkFiles(prev => prev.map(p => p.id === item.id ? { ...p, status: "error", error: err.message } : p));
      }
    }
    
    setLoading(false);
    setStatus("Caricamento multiplo completato.");
    router.refresh();
  };

  const removeBulkFile = (id: string) => {
    setBulkFiles(prev => prev.filter(p => p.id !== id));
  };

  const updateBulkFile = (id: string, fields: Partial<BulkFileItem>) => {
    setBulkFiles(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}><Upload className="size-4" /> Carica documento</Button>
        {status ? <p className="rounded-full bg-paradise-nude px-4 py-2 text-sm">{status}</p> : null}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 overflow-y-auto">
          <Card className={cn("w-full transition-all duration-300 my-8 bg-white dark:bg-neutral-900 border border-white/50", uploadMode === "bulk" ? "max-w-5xl" : "max-w-lg")}>
            <div className="mb-5 flex items-center justify-between p-1">
              <div>
                <h2 className="text-xl font-bold text-neutral-800 dark:text-white">Caricamento Documenti</h2>
                <p className="text-xs text-neutral-400 font-semibold mt-0.5">Gestisci e pubblica i cedolini o contratti del personale.</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl border border-black/10 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-neutral-800"><X className="size-4" /></button>
            </div>

            {/* Mode Selector Tab */}
            <div className="flex gap-2 mb-5 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 w-fit">
              <button
                type="button"
                onClick={() => setUploadMode("single")}
                className={cn("rounded-lg px-4 py-1.5 text-xs font-bold transition", uploadMode === "single" ? "bg-white dark:bg-neutral-900 text-neutral-850 dark:text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700")}
              >
                Singolo
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("bulk")}
                className={cn("rounded-lg px-4 py-1.5 text-xs font-bold transition", uploadMode === "bulk" ? "bg-white dark:bg-neutral-900 text-neutral-850 dark:text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700")}
              >
                Multiplo (Rilevamento Automatico)
              </button>
            </div>

            {uploadMode === "single" ? (
              /* SINGLE UPLOAD MODE */
              <form className="grid gap-3" onSubmit={submit}>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Dipendente</span>
                  <Select name="userId" required>
                    <option value="">Scegli dipendente</option>
                    {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                  </Select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Titolo Documento</span>
                  <Field name="title" placeholder="Titolo documento" required />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Tipo Documento</span>
                  <Select name="type" defaultValue="BUSTA_PAGA">
                    <option value="BUSTA_PAGA">Busta paga</option>
                    <option value="CONTRATTO">Contratto</option>
                    <option value="DOCUMENTO">Documento</option>
                  </Select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Mese</span>
                    <Field name="month" type="number" min={1} max={12} placeholder="Mese" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Anno</span>
                    <Field name="year" type="number" min={2020} max={2100} placeholder="Anno" />
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">File Documento</span>
                  <Field name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
                </label>

                {status ? <p className="rounded-xl bg-paradise-nude p-3 text-sm text-neutral-700 font-semibold">{status}</p> : null}
                <Button type="submit" disabled={loading} className="mt-2">{loading ? "Caricamento..." : "Carica e notifica"}</Button>
              </form>
            ) : (
              /* BULK UPLOAD MODE */
              <div className="space-y-4">
                {/* Drag & Drop Zone */}
                <div className="relative border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-6 text-center hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleBulkFilesChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="size-8 mx-auto text-neutral-400 mb-2" />
                  <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Seleziona o trascina i file qui</p>
                  <p className="text-[11px] text-neutral-400 font-semibold mt-2 leading-relaxed max-w-lg mx-auto">
                    Il sistema rileva i dati leggendo il <strong>nome del file</strong> (es. <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-neutral-600 dark:text-neutral-300 font-mono">Busta Aprile Steven Alvarez 2026.pdf</code>).<br />
                    Assicurati che il file contenga nel nome il <strong>Nome del Dipendente</strong> e la <strong>Mensilità (Mese e Anno)</strong>.
                  </p>
                </div>

                {bulkFiles.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                      <span className="text-xs font-bold text-neutral-500">{bulkFiles.length} file pronti</span>
                      <button
                        type="button"
                        onClick={() => setBulkFiles([])}
                        className="text-xs font-bold text-rose-600 hover:underline"
                      >
                        Svuota lista
                      </button>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1 luxury-scroll">
                      {bulkFiles.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-black/5 dark:border-white/5 rounded-xl items-center"
                        >
                          {/* Info file & status */}
                          <div className="md:col-span-3 min-w-0">
                            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 truncate" title={item.file.name}>
                              {item.file.name}
                            </p>
                            <span className="text-[9px] text-neutral-400 font-semibold font-mono">
                              {(item.file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>

                          {/* Matching employee */}
                          <div className="md:col-span-3">
                            <Select
                              value={item.userId}
                              onChange={(e) => updateBulkFile(item.id, { userId: e.target.value })}
                              required
                              className="min-h-9 text-xs py-1"
                            >
                              <option value="">Rilevamento fallito. Scegli...</option>
                              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </Select>
                          </div>

                          {/* Document Title */}
                          <div className="md:col-span-3">
                            <Field
                              value={item.title}
                              onChange={(e) => updateBulkFile(item.id, { title: e.target.value })}
                              placeholder="Titolo"
                              required
                              className="min-h-9 text-xs py-1"
                            />
                          </div>

                          {/* Inputs Month, Year, Type */}
                          <div className="md:col-span-2 grid grid-cols-3 gap-1">
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={item.month}
                              onChange={(e) => updateBulkFile(item.id, { month: e.target.value })}
                              placeholder="Mese"
                              className="h-9 w-full rounded-xl border border-black/10 bg-white dark:bg-neutral-800 text-center text-xs outline-none focus:border-paradise-pink"
                            />
                            <input
                              type="number"
                              min={2020}
                              max={2100}
                              value={item.year}
                              onChange={(e) => updateBulkFile(item.id, { year: e.target.value })}
                              placeholder="Anno"
                              className="h-9 w-full rounded-xl border border-black/10 bg-white dark:bg-neutral-800 text-center text-xs outline-none focus:border-paradise-pink col-span-2"
                            />
                          </div>

                          {/* Actions / Status */}
                          <div className="md:col-span-1 flex items-center justify-end gap-2">
                            {item.status === "uploading" && (
                              <div className="size-4 rounded-full border-2 border-paradise-pink border-t-transparent animate-spin" />
                            )}
                            {item.status === "success" && (
                              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                            )}
                            {item.status === "error" && (
                              <div title={item.error}>
                                <AlertCircle className="size-4 text-rose-500 shrink-0" />
                              </div>
                            )}
                            {item.status !== "uploading" && item.status !== "success" && (
                              <button
                                type="button"
                                onClick={() => removeBulkFile(item.id)}
                                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-neutral-400 hover:text-rose-600 transition"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {status ? <p className="rounded-xl bg-paradise-nude p-3 text-sm text-neutral-700 font-semibold">{status}</p> : null}
                    <Button
                      type="button"
                      disabled={loading || bulkFiles.every(p => p.status === "success")}
                      onClick={startBulkUpload}
                      className="w-full mt-2"
                    >
                      {loading ? "Caricamento in corso..." : "Carica tutti i file"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-neutral-400 py-6 font-semibold bg-neutral-50 dark:bg-neutral-800/10 rounded-2xl">Trascina dei file in alto per iniziare.</p>
                )}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
