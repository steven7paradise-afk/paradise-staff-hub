"use client";
import { useState } from "react";
import { departments, type OfficeConfiguration } from "@/lib/mcp/schemas";
export function McpSettings({ initial, users, grants: initialGrants }: { initial: OfficeConfiguration; users: { id: string; name: string }[]; grants: { id: string; name: string; expires: string }[] }) {
  const [config, setConfig] = useState(initial);
  const [grants, setGrants] = useState(initialGrants);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  async function save(revoke_grant_id?: string) {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/settings/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(revoke_grant_id ? { revoke_grant_id } : config) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Salvataggio non riuscito");
      if (revoke_grant_id) setGrants(current => current.filter(g => g.id !== revoke_grant_id));
      setMessage(revoke_grant_id ? "Accesso revocato." : "Configurazione salvata. I dati saranno disponibili dalla prossima chiamata MCP.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Connessione non disponibile"); } finally { setBusy(false); }
  }
  const field = "w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-neutral-900";
  const panel = "rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-900 space-y-4";
  return <div className="mx-auto max-w-5xl space-y-6 pb-12">
    <section className={panel}><h2 className="text-xl font-semibold">Persone e reparti</h2><p className="text-sm text-neutral-600">Tutti i dipendenti attivi sono inclusi automaticamente. Reparto, ruolo ed eventuale esclusione si modificano nella scheda dipendente. <a href="/staff" className="underline">Gestisci dipendenti</a></p>
      <label className="block">Cerca collaboratore<input className={field} value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome del collaboratore" /></label>
      <div className="max-h-[480px] overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Collaboratore</th><th className="p-2">Reparto condiviso</th><th className="p-2">Ruolo operativo</th></tr></thead><tbody>{users.filter(u => u.name.toLowerCase().includes(query.toLowerCase())).map(u => {
        const entry = config.employees.find(e => e.employee_id === u.id);
        return <tr key={u.id} className="border-t border-neutral-100"><th className="p-2 font-medium">{u.name}</th><td className="p-2">{departments.find(d=>d.key===entry?.department_key)?.name || "Verifica reparto o esclusione nella scheda"}</td><td className="p-2">{entry?.public_role || "Da completare"}</td></tr>;
      })}</tbody></table></div>
    </section>
    <section className={panel}><h2 className="text-xl font-semibold">Responsabili e posti</h2><p className="text-sm text-neutral-600">Lascia vuota la capienza se non è definita. Non verrà mostrato un numero inventato.</p><div className="grid gap-4 md:grid-cols-2">{departments.map(d => {
      const current = config.departments.find(v => v.key === d.key) || { key: d.key, lead_employee_id: null, capacity: null };
      const change = (patch: Partial<typeof current>) => setConfig(c => ({ ...c, departments: [...c.departments.filter(v => v.key !== d.key), { ...current, ...patch }] }));
      return <fieldset key={d.key} className="rounded-xl border p-4 space-y-3"><legend className="px-2 font-semibold">{d.name}</legend><label className="block text-sm">Capo reparto<select className={field} value={current.lead_employee_id || ""} onChange={e => change({ lead_employee_id: e.target.value || null })}><option value="">Non definito</option>{config.employees.filter(e => e.department_key === d.key).map(e => <option key={e.employee_id} value={e.employee_id}>{users.find(u => u.id === e.employee_id)?.name}</option>)}</select></label><label className="block text-sm">Capienza<input className={field} type="number" min={0} max={1000} value={current.capacity ?? ""} onChange={e => change({ capacity: e.target.value === "" ? null : Number(e.target.value) })} /></label></fieldset>;
    })}</div></section>
    <section className={panel}><h2 className="text-xl font-semibold">Testi operativi delle attività</h2><p className="text-sm text-neutral-600">Il connettore operativo condivide titoli e descrizioni originali delle attività. I testi qui sotto vengono usati soltanto se sul server è disattivata la condivisione dei testi originali (MCP_SHARE_TASK_TEXTS=false).</p>
      {config.task_texts.map((t, index) => <fieldset key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2"><label>ID attività<input className={field} value={t.task_id} onChange={e => setConfig(c => ({ ...c, task_texts: c.task_texts.map((v, i) => i === index ? { ...v, task_id: e.target.value } : v) }))} /></label><label>Titolo condivisibile<input className={field} maxLength={150} value={t.title} onChange={e => setConfig(c => ({ ...c, task_texts: c.task_texts.map((v, i) => i === index ? { ...v, title: e.target.value } : v) }))} /></label><label className="md:col-span-2">Descrizione breve<textarea className={field} maxLength={300} value={t.description} onChange={e => setConfig(c => ({ ...c, task_texts: c.task_texts.map((v, i) => i === index ? { ...v, description: e.target.value } : v) }))} /></label><button className="text-left text-sm underline" type="button" onClick={() => setConfig(c => ({ ...c, task_texts: c.task_texts.filter((_, i) => i !== index) }))}>Rimuovi testo condiviso</button></fieldset>)}
      <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setConfig(c => ({ ...c, task_texts: [...c.task_texts, { task_id: "", title: "", description: "" }] }))}>Aggiungi testo operativo</button>
    </section>
    <div className="flex flex-wrap items-center gap-4"><button disabled={busy} onClick={() => save()} className="rounded-xl bg-[#83415d] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Salvataggio…" : "Salva configurazione"}</button><p role="status">{message}</p></div>
    <section className={panel}><h2 className="text-xl font-semibold">Accessi autorizzati</h2>{!grants.length ? <p>Nessun connettore autorizzato.</p> : grants.map(g => <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div><strong>{g.name}</strong><p className="text-sm">Scadenza: {new Date(g.expires).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</p></div><button disabled={busy} className="rounded-lg border px-4 py-2" onClick={() => save(g.id)}>Revoca accesso</button></div>)}</section>
  </div>;
}
