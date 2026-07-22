"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save, Copy, CheckCircle2, AlertCircle, HelpCircle, FileSpreadsheet, DatabaseBackup } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field } from "@/components/ui";

export default function GoogleSheetSettingsPage() {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Timbrature");
  const [active, setActive] = useState(false);
  
  const [serviceAccountEmail, setServiceAccountEmail] = useState("digital@paradisebeauty.it");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings/google-sheet");
        if (response.ok) {
          const data = await response.json();
          if (data.setting) {
            setSpreadsheetId(data.setting.spreadsheet_id || "");
            setSheetName(data.setting.sheet_name || "Timbrature");
            setActive(Boolean(data.setting.active));
          }
          if (data.serviceAccountEmail) {
            setServiceAccountEmail(data.serviceAccountEmail);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheet_id: spreadsheetId, sheet_name: sheetName, active }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ type: "error", message: data.error ?? "Errore nel salvataggio delle impostazioni." });
      } else {
        setStatus({ type: "success", message: "Impostazioni Google Sheet salvate correttamente!" });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Errore di connessione." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setStatus(null);
    try {
      // Must save first to ensure we test with current inputs
      const saveResponse = await fetch("/api/settings/google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheet_id: spreadsheetId, sheet_name: sheetName, active }),
      });
      
      if (!saveResponse.ok) {
        const saveResult = await saveResponse.json();
        setStatus({ type: "error", message: saveResult.error ?? "Salvataggio fallito prima del test." });
        setTesting(false);
        return;
      }

      const response = await fetch("/api/settings/google-sheet/test", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ type: "error", message: data.error ?? "Sincronizzazione fallita. Verifica permessi condivisione." });
      } else {
        setStatus({ type: "success", message: "Test di sincronizzazione eseguito con successo! Riga aggiunta al foglio." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Errore durante il test di connessione." });
    } finally {
      setTesting(false);
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    setStatus(null);
    try {
      const saveResponse = await fetch("/api/settings/google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheet_id: spreadsheetId, sheet_name: sheetName, active }),
      });

      if (!saveResponse.ok) {
        const saveResult = await saveResponse.json();
        setStatus({ type: "error", message: saveResult.error ?? "Salvataggio fallito prima del backup." });
        setBackingUp(false);
        return;
      }

      const response = await fetch("/api/settings/google-sheet/backup", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ type: "error", message: data.error ?? "Backup database non riuscito." });
      } else {
        const totalRows = Array.isArray(data.tables) ? data.tables.reduce((sum: number, table: { rows?: number }) => sum + (table.rows ?? 0), 0) : 0;
        setStatus({ type: "success", message: `Backup database completato: ${data.tables?.length ?? 0} fogli, ${totalRows} righe salvate.` });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Errore durante il backup database." });
    } finally {
      setBackingUp(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(serviceAccountEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell title="Google Sheet" subtitle="Esportazione automatica e sincronizzazione delle timbrature dei collaboratori." role="SUPER_ADMIN">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Settings form card */}
        <Card className="border border-white/50 bg-white/95 shadow-soft p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-black/5 pb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-pink/15 text-[#B85B68]">
                <FileSpreadsheet className="size-4.5" />
              </div>
              <h2 className="text-base font-bold text-paradise-noir">Connessione Foglio</h2>
            </div>
            
            {loading ? (
              <p className="mt-6 text-sm text-black/50 text-center animate-pulse">Caricamento configurazione...</p>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider pl-1">Spreadsheet ID</span>
                  <Field 
                    value={spreadsheetId} 
                    onChange={(event) => setSpreadsheetId(event.target.value)} 
                    placeholder="Es. 1sU5ZgZ2N8i2s8rS94pU5cW7E4oT9u..."
                  />
                </div>
                
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider pl-1">Nome Tab Foglio di Lavoro</span>
                  <Field 
                    value={sheetName} 
                    onChange={(event) => setSheetName(event.target.value)} 
                    placeholder="Es. Timbrature"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-black/5 bg-neutral-50/50 p-4 select-none cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input 
                    type="checkbox" 
                    className="size-4 accent-[#B85B68]" 
                    checked={active} 
                    onChange={(event) => setActive(event.target.checked)} 
                  />
                  <div>
                    <span className="text-sm font-semibold text-paradise-noir block">Esportazione in tempo reale attiva</span>
                    <span className="text-[10px] text-black/45 block mt-0.5">Le timbrature verranno aggiunte automaticamente come nuove righe.</span>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="mt-6">
            {status && (
              <div className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold animate-in fade-in ${
                status.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-700"
              }`}>
                {status.type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
                <span>{status.message}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSave} disabled={saving || loading} className="flex-1 sm:flex-initial">
                <Save className="size-4" /> {saving ? "Salvataggio..." : "Salva Impostazioni"}
              </Button>
              <Button variant="soft" onClick={handleTest} disabled={testing || loading || !spreadsheetId} className="flex-1 sm:flex-initial">
                <RefreshCw className={`size-4 ${testing ? "animate-spin" : ""}`} /> {testing ? "Test in corso..." : "Esegui Test"}
              </Button>
              <Button variant="soft" onClick={handleBackup} disabled={backingUp || loading || !spreadsheetId} className="flex-1 sm:flex-initial">
                <DatabaseBackup className={`size-4 ${backingUp ? "animate-pulse" : ""}`} /> {backingUp ? "Backup..." : "Backup Database"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Instructions card */}
        <Card className="border border-white/50 bg-white/95 shadow-soft p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-black/5 pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-pink/15 text-[#B85B68]">
              <HelpCircle className="size-4.5" />
            </div>
            <h2 className="text-base font-bold text-paradise-noir">Guida alla Configurazione</h2>
          </div>

          <div className="mt-4 space-y-4 text-xs text-black/70 leading-relaxed">
            <div>
              <p className="font-bold text-[#B85B68] text-xs">1. Trova lo Spreadsheet ID</p>
              <p className="mt-1">
                Apri il tuo foglio Google Sheets nel browser. Copia la stringa di caratteri presente nella barra dell'indirizzo tra <code className="bg-neutral-100 px-1 py-0.5 rounded">/d/</code> e <code className="bg-neutral-100 px-1 py-0.5 rounded">/edit</code>.
              </p>
              <p className="text-[10px] text-black/45 mt-1 font-mono">
                Esempio URL: https://docs.google.com/spreadsheets/d/<strong className="text-paradise-noir bg-paradise-nude px-1 rounded">1sU5ZgZ...</strong>/edit#gid=0
              </p>
            </div>

            <div>
              <p className="font-bold text-[#B85B68] text-xs">2. Condividi il Foglio di Lavoro (Editor)</p>
              <p className="mt-1">
                Per consentire all'applicazione di registrare le timbrature, clicca sul pulsante <strong className="text-paradise-noir">"Condividi"</strong> in alto a destra nel tuo Google Sheet e aggiungi l'email del service account come <strong className="text-emerald-700 font-bold">Editor</strong>:
              </p>
              
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-paradise-pink/20 bg-paradise-nude/40 p-2.5">
                <span className="font-mono text-[11px] text-paradise-noir truncate font-semibold">
                  {serviceAccountEmail}
                </span>
                <button 
                  onClick={handleCopy}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all"
                  title="Copia negli appunti"
                >
                  <Copy className={`size-3.5 ${copied ? "text-emerald-600" : "text-[#B85B68]"}`} />
                </button>
              </div>
              {copied && <p className="text-emerald-600 text-[10px] font-bold text-right mt-1">Copiato negli appunti!</p>}
            </div>

            <div>
              <p className="font-bold text-[#B85B68] text-xs">3. Struttura la Tabella</p>
              <p className="mt-1">
                Verifica che nel foglio ci sia una scheda chiamata esattamente come il <strong className="text-paradise-noir">Nome Tab</strong> specificato a sinistra (es. <strong className="text-paradise-noir">"Timbrature"</strong>) e che contenga colonne per raccogliere i dati esportati (es. Data, Ora, Dipendente, Tipo, ecc.).
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
