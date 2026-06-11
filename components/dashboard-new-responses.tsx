"use client";

import React, { useState } from "react";
import { ClipboardList, ArrowRight } from "lucide-react";
import { ResponseDetailModal } from "@/components/response-detail-modal";

type DashboardNewResponsesProps = {
  initialResponses: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
};

export function DashboardNewResponses({
  initialResponses,
  currentUserId,
  currentUserName,
  currentUserRole,
}: DashboardNewResponsesProps) {
  const [responses, setResponses] = useState(initialResponses);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);

  const activeResponses = responses.filter((r) => r.status !== "ARCHIVED");

  if (activeResponses.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#e8b1bf]/40 bg-gradient-to-r from-paradise-softPink/40 to-white dark:from-white/5 dark:to-[#201F24] p-5 shadow-sm backdrop-blur-md mb-6">
      <div className="absolute top-0 right-0 -z-10 translate-x-6 -translate-y-6 size-20 rounded-full bg-[#A74758]/10 blur-xl animate-pulse-soft" />
      
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-[#A74758]/10 text-[#A74758] shadow-sm">
            <ClipboardList className="size-5.5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-base text-black dark:text-white flex items-center gap-2">
              Moduli compilati da verificare
              <span className="inline-flex items-center justify-center size-5 text-xs font-bold text-white bg-[#C66170] rounded-full shadow-sm">
                {activeResponses.length}
              </span>
            </h3>
            <p className="text-xs text-black/55 dark:text-white/40 mt-0.5">Seleziona una risposta per controllarla e gestirla.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {activeResponses.map((r: any) => (
          <button 
            key={r.id} 
            type="button"
            onClick={() => setSelectedResponseId(r.id)}
            className="w-full text-left group flex items-center justify-between rounded-2xl border border-black/5 bg-white/70 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 p-3.5 transition duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid size-9 place-items-center rounded-xl bg-[#A74758]/10 text-[#A74758] shrink-0">
                <ClipboardList className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-black dark:text-white truncate">{r.form?.name || "Modulo"}</p>
                <p className="text-xs text-black/55 dark:text-white/40 mt-0.5 truncate">
                  Inviato da <strong className="text-black/75 dark:text-white/70">{r.user?.name || "Dipendente"}</strong> il {new Date(r.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <div className="shrink-0 inline-flex items-center gap-1 text-xs font-extrabold text-[#A74758] bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 px-3 py-1.5 rounded-xl group-hover:translate-x-0.5 transition duration-200">
              Apri <ArrowRight className="size-3.5" />
            </div>
          </button>
        ))}
      </div>

      {selectedResponseId && (
        <ResponseDetailModal
          responseId={selectedResponseId}
          isOpen={true}
          onClose={() => setSelectedResponseId(null)}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
          onArchiveSuccess={(archivedId) => {
            setResponses((prev) =>
              prev.map((item) => (item.id === archivedId ? { ...item, status: "ARCHIVED" } : item))
            );
          }}
        />
      )}
    </div>
  );
}
