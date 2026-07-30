"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Gift, 
  Award, 
  Zap, 
  Megaphone, 
  Bell, 
  Check, 
  Clock,
  Camera,
  FileText,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  user: {
    id: string;
    name: string;
    role: string;
  };
  pointsStats: {
    schedeCount: number;
    workerGoal: number;
    salonSchedeCount: number;
    salonGoal: number;
    salonEarned: boolean;
    workerEarned: boolean;
    manualBonusPoints: number;
    redeemedPoints: number;
    availablePoints: number;
    totalEarnedPoints: number;
  };
  readCommunications: Array<{
    id: string;
    title: string;
    createdAt: string;
  }>;
  unreadCommunications: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
};

export function PointsClient({
  user,
  pointsStats,
  readCommunications = [],
  unreadCommunications = [],
}: Props) {
  const [activeComms, setActiveComms] = useState<any[]>([]);
  const [claimedBonus, setClaimedBonus] = useState(0);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [readCommsList, setReadCommsList] = useState<any[]>([]);

  useEffect(() => {
    setActiveComms(unreadCommunications);
    setReadCommsList(readCommunications);
  }, [unreadCommunications, readCommunications]);

  const handleClaimPoint = async (commId: string, title: string) => {
    setClaimingId(commId);
    try {
      const res = await fetch(`/api/notifications/${commId}/claim-point`, {
        method: "POST",
      });
      if (res.ok) {
        setClaimedBonus((prev) => prev + 1);
        setActiveComms((prev) => prev.filter((c) => c.id !== commId));
        setReadCommsList((prev) => [
          { id: commId, title, createdAt: new Date().toISOString() },
          ...prev,
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setClaimingId(null);
    }
  };

  const currentMonthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date()).toUpperCase();
  const isEmployee = user.role === "DIPENDENTE";

  const initialAvailable = pointsStats.availablePoints;
  const currentAvailablePoints = initialAvailable + claimedBonus;

  // Let's build the chronological points ledger (libro mastro)
  type LedgerTransaction = {
    title: string;
    pointsLabel: string;
    isNegative: boolean;
    date: string;
    icon: any;
  };

  const transactions: LedgerTransaction[] = [];

  // 1. Notice readings (+1 per notification read)
  readCommsList.forEach((c) => {
    transactions.push({
      title: `Lettura e firma avviso: "${c.title}"`,
      pointsLabel: "+1 Punto",
      isNegative: false,
      date: c.createdAt,
      icon: Megaphone,
    });
  });

  // 2. Personal target goal reached (+10 points)
  if (pointsStats.workerEarned) {
    transactions.push({
      title: `Traguardo Obiettivo Personale sbloccato (${pointsStats.schedeCount}/${pointsStats.workerGoal} schede)`,
      pointsLabel: "+10 Punti",
      isNegative: false,
      date: new Date().toISOString(), // Fallback to current month
      icon: Award,
    });
  }

  // 3. Salon target goal reached (+10 points)
  if (pointsStats.salonEarned) {
    transactions.push({
      title: `Traguardo Obiettivo Salone sbloccato (${pointsStats.salonSchedeCount}/${pointsStats.salonGoal} schede)`,
      pointsLabel: "+10 Punti",
      isNegative: false,
      date: new Date().toISOString(),
      icon: Zap,
    });
  }

  // 4. Manual bonus points given by Admin (excluding point earned by notice readings)
  // Note: in page.tsx, manualBonusPoints represents total manual points. Some might be from notice readings.
  // We can calculate points from manual bonus separate from read communications:
  const readCommPointCount = readCommunications.length;
  const adminManualAdjustment = pointsStats.manualBonusPoints - readCommPointCount;

  if (adminManualAdjustment > 0) {
    transactions.push({
      title: "Bonus extra accreditato dall'amministrazione",
      pointsLabel: `+${adminManualAdjustment} Punti`,
      isNegative: false,
      date: new Date().toISOString(),
      icon: Award,
    });
  } else if (adminManualAdjustment < 0) {
    transactions.push({
      title: "Rettifica punti da parte dell'amministrazione",
      pointsLabel: `${adminManualAdjustment} Punti`,
      isNegative: true,
      date: new Date().toISOString(),
      icon: Award,
    });
  }

  // 5. Redemptions (-10 points each)
  if (pointsStats.redeemedPoints > 0) {
    const redemptionCount = Math.floor(pointsStats.redeemedPoints / 10);
    for (let i = 0; i < redemptionCount; i++) {
      transactions.push({
        title: `Riscatto premio catalogo (Piega o Trattamento)`,
        pointsLabel: "-10 Punti",
        isNegative: true,
        date: new Date().toISOString(),
        icon: Gift,
      });
    }
  }

  // Sort transactions by date (descending)
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-20 px-4 md:px-0 font-sans antialiased text-neutral-900 selection:bg-neutral-200">
      
      {/* 🖤 DIOR ESTHETIQUE TOP BAR */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Torna alla Dashboard</span>
        </Link>
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400">
          PARADISE CENTRO PUNTI
        </span>
      </div>

      {/* 🖤 MAIN HERO BALANCE CONTAINER */}
      <div className="border border-neutral-200 bg-white p-8 md:p-12 rounded-[24px] shadow-2xs text-center space-y-6">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">IL TUO SALDO PREMIUM</span>
          <h2 className="text-5xl md:text-6xl font-serif font-light text-neutral-900 tracking-wide uppercase mt-2">
            {currentAvailablePoints} <span className="text-sm font-sans font-bold tracking-[0.2em] text-neutral-500 uppercase ml-1">Punti</span>
          </h2>
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-1.5">
            Disponibili per il riscatto premi nel catalogo Paradise
          </p>
        </div>

        {/* Action / Progress Row */}
        <div className="pt-6 border-t border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-6 max-w-3xl mx-auto">
          <div className="text-left space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400 block">OBIETTIVO MENSILE ({currentMonthName})</span>
            <span className="text-xs font-bold text-neutral-700">
              Schede Completate: <strong className="text-neutral-900">{pointsStats.schedeCount} / {pointsStats.workerGoal}</strong>
            </span>
          </div>

          {currentAvailablePoints >= 10 ? (
            <Link
              href="/requests"
              className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-[0.2em] px-8 py-4 rounded-xl shadow-xs transition duration-200"
            >
              Riscatta Premio (10 Punti)
            </Link>
          ) : (
            <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 bg-neutral-50 border border-neutral-200 px-6 py-3 rounded-xl">
              Accumula 10 punti per riscattare un premio
            </div>
          )}
        </div>
      </div>

      {/* 📢 AVVISI IMPORTANTI DA FIRMARE */}
      {activeComms.length > 0 && (
        <div className="space-y-4 text-left">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400">COMUNICAZIONI DA FIRMARE</span>
          <div className="space-y-3">
            {activeComms.map((comm) => (
              <div 
                key={comm.id}
                className="bg-neutral-50 border border-neutral-200 p-5 md:p-6 rounded-[20px] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
                    <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider">{comm.title}</h4>
                  </div>
                  <p className="text-xs text-neutral-600 pl-4 font-normal leading-relaxed">{comm.message}</p>
                </div>

                <button
                  disabled={claimingId === comm.id}
                  onClick={() => handleClaimPoint(comm.id, comm.title)}
                  className="shrink-0 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[9px] tracking-[0.18em] uppercase px-5 py-3 rounded-xl shadow-2xs transition duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={12} />
                  <span>Letto e compreso (+1 Punto)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 👤 TWO-COLUMN GRID: STORICO & REGOLAMENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Points Ledger (2/3) */}
        <div className="border border-neutral-200 bg-white p-6 md:p-8 rounded-[24px] shadow-2xs space-y-6 lg:col-span-2 text-left">
          <div className="border-b border-neutral-100 pb-4">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">IL TUO ESTRATTO CONTO</span>
            <h2 className="text-xl font-serif font-light text-neutral-900 uppercase mt-0.5">
              Registro Storico Punti
            </h2>
            <p className="text-xs text-neutral-400 mt-1 font-medium">
              Lista cronologica dettagliata di come hai guadagnato e speso i tuoi punti Paradise.
            </p>
          </div>

          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-100 text-xs">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 border-b border-neutral-100">
                    <th className="py-3 pr-4 text-left">Descrizione Movimento</th>
                    <th className="py-3 px-4 text-left">Data Registrazione</th>
                    <th className="py-3 pl-4 text-right">Movimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-700">
                  {transactions.map((t, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/50 transition duration-150">
                      <td className="py-4 pr-4 font-bold text-neutral-900 flex items-center gap-2.5">
                        <t.icon size={14} className="text-neutral-400 shrink-0" />
                        <span>{t.title}</span>
                      </td>
                      <td className="py-4 px-4 text-neutral-400">
                        {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t.date))}
                      </td>
                      <td className={cn(
                        "py-4 pl-4 text-right font-bold text-sm",
                        t.isNegative ? "text-red-600" : "text-emerald-700"
                      )}>
                        {t.pointsLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50 p-6">
              <Clock size={24} className="text-neutral-300 mb-2" />
              <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Nessun movimento registrato</p>
              <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
                I tuoi movimenti appariranno qui man mano che completi obiettivi o leggi le comunicazioni.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Regulations / Regolamento (1/3) */}
        <div className="border border-neutral-200 bg-white p-6 md:p-8 rounded-[24px] shadow-2xs space-y-6 lg:col-span-1 h-fit text-left">
          <div className="border-b border-neutral-100 pb-4">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">GUIDA RAPIDA</span>
            <h2 className="text-xl font-serif font-light text-neutral-900 uppercase mt-0.5">
              Regolamento Punti
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            {[
              { title: "Foto Prima/Dopo Cliente", desc: "Carica 1 foto frontale prima e dopo il servizio per documentazione.", pts: "+1 Punto", icon: Camera },
              { title: "Note e Qualità", desc: "Compila accuratamente le note per ogni cliente su Controllo Cliente.", pts: "Qualità", icon: FileText },
              { title: "Obiettivo Personale", desc: "Raggiungi il tuo target mensile di schede compilate.", pts: "+10 Punti", icon: Award },
              { title: "Obiettivo Salone (Admin)", desc: "Collabora per raggiungere il target cumulativo del salone.", pts: "+10 Punti", icon: Zap },
              { title: "Lettura Avvisi Importanti", desc: "Leggi e firma gli avvisi in cima per dichiarare la comprensione.", pts: "+1 Punto", icon: Bell },
            ].map((rule, idx) => (
              <div key={idx} className="flex items-start gap-3 border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                <div className="w-6 h-6 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-600 shrink-0 mt-0.5">
                  <rule.icon size={11} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between font-bold text-neutral-900">
                    <span>{rule.title}</span>
                    <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider font-mono">{rule.pts}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-normal">{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">
        PARADISE — CENTRO TRASPARENZA PUNTI
      </div>

    </div>
  );
}
