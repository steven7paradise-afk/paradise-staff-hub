"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  Target, 
  Tag, 
  ShoppingBag, 
  Bell, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  AlertCircle,
  LayoutGrid
} from "lucide-react";

type Promo = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  expirationDate: string;
  ctaText: string;
  ctaUrl: string;
  materialeGraficoUrl?: string;
  active: boolean;
  image?: string;
};

type SideCard = {
  category: string;
  title: string;
  badge: string;
  description: string;
  url: string;
};

type ProductOfMonth = {
  title: string;
  subtitle: string;
  description: string;
  originalPrice: number;
  discountPrice: number;
  badge: string;
  image?: string;
};

type Communication = {
  id: string;
  title: string;
  detail: string;
  tag: string;
};

type Props = {
  initialSettings: {
    salonGoal: number;
    workerGoal: number;
    workerBonusMap?: Record<string, { manualBonusPoints?: number; redeemedPoints?: number }>;
    promos: Promo[];
    sideCard1?: SideCard;
    sideCard2?: SideCard;
    productOfMonth: ProductOfMonth;
    communications: Communication[];
  };
};

export function DashboardSettingsClient({ initialSettings }: Props) {
  const router = useRouter();
  const [salonGoal, setSalonGoal] = useState<number>(initialSettings.salonGoal || 500);
  const [workerGoal, setWorkerGoal] = useState<number>(initialSettings.workerGoal || 100);
  const workerBonusMap = initialSettings.workerBonusMap || {};
  
  const [promos, setPromos] = useState<Promo[]>(initialSettings.promos || []);
  
  const [sideCard1, setSideCard1] = useState<SideCard>(initialSettings.sideCard1 || {
    category: "PORTA UN'AMICA",
    title: "PIEGA IN OMAGGIO",
    badge: "x2",
    description: "NUOVA CLIENTE PRESENTATA = PIEGA GRATIS",
    url: "/client-control"
  });

  const [sideCard2, setSideCard2] = useState<SideCard>(initialSettings.sideCard2 || {
    category: "LOYALTY · PARADISE CARD",
    title: "PUNTI DOPPI",
    badge: "◆",
    description: "SU TUTTI I PRODOTTI RETAIL FINO A DOMENICA",
    url: "/tables"
  });

  const [productOfMonth, setProductOfMonth] = useState<ProductOfMonth>(initialSettings.productOfMonth || {
    title: "PRO-GLOW SERUM",
    subtitle: "CONSIGLIATO • UPSELL",
    description: "Siero termoprotettivo. Perfetto da abbinare a ogni cheratina.",
    originalPrice: 32,
    discountPrice: 26,
    badge: "RETAIL",
  });

  const [communications, setCommunications] = useState<Communication[]>(initialSettings.communications || []);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddPromo = () => {
    const newPromo: Promo = {
      id: `promo-${Date.now()}`,
      title: "NUOVA PROMOZIONAL",
      subtitle: "OFFERTA SPECIALE",
      description: "Inserisci qui la descrizione della promo per lo staff e le clienti.",
      badge: "VALIDA A TEMPO",
      expirationDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      ctaText: "SCOPRI DI PIÙ",
      ctaUrl: "/service-forms",
      materialeGraficoUrl: "/documents",
      active: true,
    };
    setPromos((prev) => [...prev, newPromo]);
  };

  const handleRemovePromo = (id: string) => {
    setPromos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePromo = (id: string, field: keyof Promo, value: any) => {
    setPromos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleAddCommunication = () => {
    const newComm: Communication = {
      id: `comm-${Date.now()}`,
      title: "Nuova comunicazione",
      detail: "Testo dell'avviso per lo staff.",
      tag: "DIREZIONE • OGGI",
    };
    setCommunications((prev) => [...prev, newComm]);
  };

  const handleRemoveCommunication = (id: string) => {
    setCommunications((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateCommunication = (id: string, field: keyof Communication, value: string) => {
    setCommunications((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/settings/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonGoal,
          workerGoal,
          workerBonusMap,
          promos,
          sideCard1,
          sideCard2,
          productOfMonth,
          communications,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossibile salvare le impostazioni");
      }

      setSuccessMsg("Impostazioni salvate con successo. Le modifiche sono ora attive sulla Dashboard.");
      router.refresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Errore imprevisto durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      
      {/* Top Floating Save Action Bar */}
      <div className="flex items-center justify-between gap-4 bg-zinc-50 border border-zinc-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-600">
          <Sparkles size={16} className="text-red-600" />
          <span>Modifiche in Tempo Reale sulla Dashboard</span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-6 py-2.5 flex items-center gap-2 transition disabled:opacity-50 shrink-0 shadow-sm"
        >
          {saving ? (
            <span>Salvataggio in corso...</span>
          ) : (
            <>
              <Save size={16} />
              <span>Salva Configurazione</span>
            </>
          )}
        </button>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 font-bold text-xs flex items-center gap-3">
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 font-bold text-xs flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION 1: OBIETTIVI SCHEDE MENSILI */}
      <div className="bg-white border border-zinc-200 p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-4">
          <Target className="text-red-600" size={20} />
          <h2 className="text-base font-black uppercase tracking-wider text-black">
            1. Target Schede Mensili Salone & Dipendenti
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-700 block">
              Obiettivo Salone (Schede Mese)
            </label>
            <p className="text-[11px] text-zinc-500">
              Totale schede Controllo Cliente che il salone deve completare questo mese per sbloccare il premio salone (es. 500 o 700 schede).
            </p>
            <input
              type="number"
              min={1}
              value={salonGoal}
              onChange={(e) => setSalonGoal(Number(e.target.value))}
              className="w-full bg-zinc-50 border border-zinc-300 px-4 py-2.5 text-sm font-black text-black focus:outline-none focus:border-black"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-700 block">
              Obiettivo Singolo Dipendente (Schede Mese)
            </label>
            <p className="text-[11px] text-zinc-500">
              Schede minime che ogni singolo lavoratore deve compilare al mese per raggiungere il proprio traguardo individuale (es. 100 o 150 schede).
            </p>
            <input
              type="number"
              min={1}
              value={workerGoal}
              onChange={(e) => setWorkerGoal(Number(e.target.value))}
              className="w-full bg-zinc-50 border border-zinc-300 px-4 py-2.5 text-sm font-black text-black focus:outline-none focus:border-black"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: PROMOZIONI & SLIDER CAMPAGNE */}
      <div className="bg-white border border-zinc-200 p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2">
            <Tag className="text-red-600" size={20} />
            <h2 className="text-base font-black uppercase tracking-wider text-black">
              2. Slider Promozioni Attive con Scadenza Automatizzata
            </h2>
          </div>

          <button
            onClick={handleAddPromo}
            className="bg-black hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-wider px-4 py-2 flex items-center gap-1.5 transition"
          >
            <Plus size={14} />
            <span>Aggiungi Promo</span>
          </button>
        </div>

        <div className="space-y-6">
          {promos.map((promo, index) => (
            <div
              key={promo.id || index}
              className={`p-5 border ${
                promo.active ? "border-zinc-300 bg-zinc-50/50" : "border-zinc-200 bg-zinc-100 opacity-60"
              } space-y-4 relative`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="bg-black text-white font-black text-xs w-6 h-6 flex items-center justify-center">
                    #{index + 1}
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    {promo.title || "Senza Titolo"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer">
                    <input
                      type="checkbox"
                      checked={promo.active}
                      onChange={(e) => handleUpdatePromo(promo.id, "active", e.target.checked)}
                      className="w-4 h-4 accent-red-600"
                    />
                    <span>{promo.active ? "Attiva" : "Nascosta"}</span>
                  </label>

                  <button
                    onClick={() => handleRemovePromo(promo.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 transition"
                    title="Elimina Promo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Titolo Promo (evidenzia in rosso GLOW/-20%)</label>
                  <input
                    type="text"
                    value={promo.title}
                    onChange={(e) => handleUpdatePromo(promo.id, "title", e.target.value)}
                    className="w-full bg-white border border-zinc-300 p-2 text-black font-black uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Sottotitolo (es. PROMO DELLA SETTIMANA)</label>
                  <input
                    type="text"
                    value={promo.subtitle}
                    onChange={(e) => handleUpdatePromo(promo.id, "subtitle", e.target.value)}
                    className="w-full bg-white border border-zinc-300 p-2 text-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Data Scadenza Automatizzata (Scompare allo scadere)</label>
                  <input
                    type="date"
                    value={promo.expirationDate || ""}
                    onChange={(e) => handleUpdatePromo(promo.id, "expirationDate", e.target.value)}
                    className="w-full bg-white border border-zinc-300 p-2 text-black font-mono"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Descrizione Dettagliata Promo</label>
                  <textarea
                    rows={2}
                    value={promo.description}
                    onChange={(e) => handleUpdatePromo(promo.id, "description", e.target.value)}
                    className="w-full bg-white border border-zinc-300 p-2 text-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Badge/Etichetta (es. VALIDA FINO A FINE MESE)</label>
                  <input
                    type="text"
                    value={promo.badge}
                    onChange={(e) => handleUpdatePromo(promo.id, "badge", e.target.value)}
                    className="w-full bg-white border border-zinc-300 p-2 text-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Testo Bottone Principale (CTA)</label>
                  <input
                    type="text"
                    value={promo.ctaText}
                    onChange={(e) => handleUpdatePromo(promo.id, "ctaText", e.target.value)}
                    className="w-full bg-white border border-zinc-300 p-2 text-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Link Bottone Principale (es. /service-forms)</label>
                  <input
                    type="text"
                    value={promo.ctaUrl}
                    onChange={(e) => handleUpdatePromo(promo.id, "ctaUrl", e.target.value)}
                    className="w-full bg-white border border-zinc-300 p-2 text-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500">Link Materiale Grafico (Dropbox/Drive/URL)</label>
                  <input
                    type="text"
                    value={promo.materialeGraficoUrl || ""}
                    onChange={(e) => handleUpdatePromo(promo.id, "materialeGraficoUrl", e.target.value)}
                    placeholder="https://drive.google.com/... o /documents"
                    className="w-full bg-white border border-zinc-300 p-2 text-black font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: CARD LATERALI (PORTA UN'AMICA & LOYALTY) */}
      <div className="bg-white border border-zinc-200 p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-4">
          <LayoutGrid className="text-red-600" size={20} />
          <h2 className="text-base font-black uppercase tracking-wider text-black">
            3. Card Laterali (Porta un'Amica & Loyalty Paradise Card)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-bold">
          {/* Side Card 1 */}
          <div className="p-5 border border-zinc-300 bg-zinc-50 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-600">Card Superiore 1</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Categoria/Intestazione</label>
              <input
                type="text"
                value={sideCard1.category}
                onChange={(e) => setSideCard1({ ...sideCard1, category: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-black uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Titolo Principale</label>
              <input
                type="text"
                value={sideCard1.title}
                onChange={(e) => setSideCard1({ ...sideCard1, title: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-black uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Badge Destra (es. x2 o ◆)</label>
              <input
                type="text"
                value={sideCard1.badge}
                onChange={(e) => setSideCard1({ ...sideCard1, badge: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-black uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Descrizione</label>
              <input
                type="text"
                value={sideCard1.description}
                onChange={(e) => setSideCard1({ ...sideCard1, description: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Link Destinazione</label>
              <input
                type="text"
                value={sideCard1.url}
                onChange={(e) => setSideCard1({ ...sideCard1, url: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-mono"
              />
            </div>
          </div>

          {/* Side Card 2 */}
          <div className="p-5 border border-zinc-300 bg-zinc-50 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-600">Card Superiore 2</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Categoria/Intestazione</label>
              <input
                type="text"
                value={sideCard2.category}
                onChange={(e) => setSideCard2({ ...sideCard2, category: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-black uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Titolo Principale</label>
              <input
                type="text"
                value={sideCard2.title}
                onChange={(e) => setSideCard2({ ...sideCard2, title: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-black uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Badge Destra (es. ◆)</label>
              <input
                type="text"
                value={sideCard2.badge}
                onChange={(e) => setSideCard2({ ...sideCard2, badge: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-black uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Descrizione</label>
              <input
                type="text"
                value={sideCard2.description}
                onChange={(e) => setSideCard2({ ...sideCard2, description: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Link Destinazione</label>
              <input
                type="text"
                value={sideCard2.url}
                onChange={(e) => setSideCard2({ ...sideCard2, url: e.target.value })}
                className="w-full bg-white border border-zinc-300 p-2 text-black font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: PRODOTTO DEL MESE */}
      <div className="bg-white border border-zinc-200 p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-4">
          <ShoppingBag className="text-red-600" size={20} />
          <h2 className="text-base font-black uppercase tracking-wider text-black">
            4. Prodotto del Mese (Retail)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-zinc-500">Nome Prodotto</label>
            <input
              type="text"
              value={productOfMonth.title}
              onChange={(e) => setProductOfMonth({ ...productOfMonth, title: e.target.value })}
              className="w-full bg-zinc-50 border border-zinc-300 p-2 text-black font-black uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase text-zinc-500">Sottotitolo / Suggerimento</label>
            <input
              type="text"
              value={productOfMonth.subtitle}
              onChange={(e) => setProductOfMonth({ ...productOfMonth, subtitle: e.target.value })}
              className="w-full bg-zinc-50 border border-zinc-300 p-2 text-black"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase text-zinc-500">Etichetta Badge (es. RETAIL)</label>
            <input
              type="text"
              value={productOfMonth.badge}
              onChange={(e) => setProductOfMonth({ ...productOfMonth, badge: e.target.value })}
              className="w-full bg-zinc-50 border border-zinc-300 p-2 text-black"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] uppercase text-zinc-500">Descrizione del Prodotto</label>
            <input
              type="text"
              value={productOfMonth.description}
              onChange={(e) => setProductOfMonth({ ...productOfMonth, description: e.target.value })}
              className="w-full bg-zinc-50 border border-zinc-300 p-2 text-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Prezzo Originale €</label>
              <input
                type="number"
                value={productOfMonth.originalPrice}
                onChange={(e) => setProductOfMonth({ ...productOfMonth, originalPrice: Number(e.target.value) })}
                className="w-full bg-zinc-50 border border-zinc-300 p-2 text-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-500">Prezzo Scontato €</label>
              <input
                type="number"
                value={productOfMonth.discountPrice}
                onChange={(e) => setProductOfMonth({ ...productOfMonth, discountPrice: Number(e.target.value) })}
                className="w-full bg-zinc-50 border border-zinc-300 p-2 text-black font-black"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: COMUNICAZIONI DIREZIONE */}
      <div className="bg-white border border-zinc-200 p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2">
            <Bell className="text-red-600" size={20} />
            <h2 className="text-base font-black uppercase tracking-wider text-black">
              5. Comunicazioni Direzione (Bacheca In basso)
            </h2>
          </div>

          <button
            onClick={handleAddCommunication}
            className="bg-black hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-wider px-4 py-2 flex items-center gap-1.5 transition"
          >
            <Plus size={14} />
            <span>Nuovo Avviso</span>
          </button>
        </div>

        <div className="space-y-4">
          {communications.map((comm) => (
            <div key={comm.id} className="p-4 border border-zinc-200 bg-zinc-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-bold">
                <input
                  type="text"
                  value={comm.title}
                  onChange={(e) => handleUpdateCommunication(comm.id, "title", e.target.value)}
                  placeholder="Titolo avviso"
                  className="bg-white border border-zinc-300 p-2 font-black uppercase text-black"
                />
                <input
                  type="text"
                  value={comm.detail}
                  onChange={(e) => handleUpdateCommunication(comm.id, "detail", e.target.value)}
                  placeholder="Dettaglio avviso"
                  className="bg-white border border-zinc-300 p-2 text-black"
                />
                <input
                  type="text"
                  value={comm.tag}
                  onChange={(e) => handleUpdateCommunication(comm.id, "tag", e.target.value)}
                  placeholder="Tag temporale (es. DIREZIONE • OGGI)"
                  className="bg-white border border-zinc-300 p-2 text-black"
                />
              </div>

              <button
                onClick={() => handleRemoveCommunication(comm.id)}
                className="p-2 text-zinc-400 hover:text-red-600 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
