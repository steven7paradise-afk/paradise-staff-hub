"use client";

import React, { useState } from "react";
import { ClipboardList, ArrowRight, CheckCircle2, Calendar } from "lucide-react";
import { ResponseDetailModal } from "@/components/response-detail-modal";
import { Card } from "@/components/ui";

type ToVerifyViewerProps = {
  initialResponses: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
};

export function ToVerifyViewer({
  initialResponses,
  currentUserId,
  currentUserName,
  currentUserRole,
}: ToVerifyViewerProps) {
  const [responses, setResponses] = useState(initialResponses);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);

  const activeResponses = responses.filter((r) => r.status !== "ARCHIVED");

  const getClientName = (r: any) => {
    // Attempt to extract client name from answers
    const answers = r.answers || {};
    return answers.field_1782212649889 || answers.client_control_client_name || answers.cliente || "Scheda compilata";
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-paradise-softPink text-[#A74758]">
            <ClipboardList className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Verifica</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Moduli da Verificare</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">
              Lista dei moduli compilati in attesa di approvazione o archiviazione. Una volta gestiti, spariranno automaticamente da questo elenco.
            </p>
          </div>
        </div>
      </div>

      <Card className="bg-white">
        <div className="flex items-center justify-between border-b border-black/5 pb-4 mb-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Da controllare
            <span className="inline-flex items-center justify-center size-6 text-xs font-bold text-white bg-[#C66170] rounded-full">
              {activeResponses.length}
            </span>
          </h2>
        </div>

        {activeResponses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
              <CheckCircle2 className="size-6" />
            </div>
            <h3 className="font-semibold text-base text-black">Ottimo lavoro!</h3>
            <p className="text-sm text-black/45 mt-1">Non ci sono moduli da verificare al momento.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeResponses.map((r: any) => (
              <div 
                key={r.id} 
                className="group flex flex-col justify-between rounded-2xl border border-black/5 bg-[#FBF7F9] p-4.5 hover:bg-white hover:shadow-md hover:border-black/10 transition duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-block rounded-lg bg-[#A74758]/10 text-[#A74758] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider">
                      {r.form?.name || "Modulo"}
                    </span>
                    <span className="text-[10px] text-black/40 flex items-center gap-1 font-semibold">
                      <Calendar className="size-3" />
                      {new Date(r.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <h3 className="mt-3.5 font-bold text-base text-black truncate">
                    {getClientName(r)}
                  </h3>
                  <p className="text-xs text-black/55 mt-1.5">
                    Compilato da: <strong className="text-black/80">{r.user?.name || "Staff"}</strong>
                  </p>
                  <p className="text-[11px] text-black/40 mt-1">
                    Salone: <strong>{r.user_location_name || r.user?.location?.name || "Non indicato"}</strong>
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-black/5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedResponseId(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-[#A74758]/10 hover:text-[#A74758] text-black/70 border border-black/5 px-3.5 py-2 text-xs font-bold transition duration-200 shadow-sm"
                  >
                    Controlla <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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
          onUpdateSuccess={(updatedResponse) => {
            setResponses((prev) =>
              prev.map((item) => (item.id === updatedResponse.id ? updatedResponse : item))
            );
          }}
        />
      )}
    </div>
  );
}
