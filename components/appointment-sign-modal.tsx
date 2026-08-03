import { useEffect, useState } from "react";
import { Loader2, X, AlertCircle } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

interface ActiveWorker {
  id: string;
  name: string;
  photo_url?: string | null;
  locationName: string;
  status: string;
}

interface AppointmentSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (workerName: string) => void;
  title?: string;
  description?: string;
  fallbackWorkers?: Array<{ id: string; name: string; photoUrl?: string | null }>;
}

export function AppointmentSignModal({
  isOpen,
  onClose,
  onSign,
  title = "Firma la modifica",
  description = "Seleziona la tua foto per firmare questa operazione all'agenda.",
  fallbackWorkers = [],
}: AppointmentSignModalProps) {
  const [activeStaff, setActiveStaff] = useState<ActiveWorker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllFallback, setShowAllFallback] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError("");
    setShowAllFallback(false);

    fetch("/api/appointments/pc/active-staff")
      .then((res) => {
        if (!res.ok) throw new Error("Impossibile recuperare lo staff attivo.");
        return res.json();
      })
      .then((data) => {
        setActiveStaff(data);
        if (data.length === 0) {
          setShowAllFallback(true);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Impossibile caricare il personale attivo. Mostro tutto lo staff.");
        setShowAllFallback(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const displayList = showAllFallback
    ? fallbackWorkers.map((w) => ({
        id: w.id,
        name: w.name,
        photo_url: w.photoUrl,
        locationName: "",
        status: "",
      }))
    : activeStaff;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border border-[#E8D8CF] rounded-[32px] max-w-xl w-full p-8 shadow-2xl relative space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-800"
        >
          <X size={18} />
        </button>

        <div className="space-y-1.5 text-center">
          <h2 className="text-xl font-serif font-light tracking-wide uppercase text-neutral-900">
            {title}
          </h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {description}
          </p>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="size-8 animate-spin text-[#A56A42]" />
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">Caricamento staff in turno...</span>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Stata Info if fallback active */}
            {!isLoading && activeStaff.length === 0 && !error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-semibold leading-relaxed">
                <AlertCircle size={14} className="shrink-0 text-amber-700" />
                <span>Nessun dipendente risulta timbrato in turno oggi. Mostro l'elenco generale dello staff.</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-700 text-[11px] font-semibold leading-relaxed">
                <AlertCircle size={14} className="shrink-0 text-neutral-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Main Staff Select Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto p-1">
              {displayList.map((worker) => {
                const photoUrl = resolveDrivePhotoUrl(worker.photo_url || "");
                const initials = getInitials(worker.name);

                return (
                  <button
                    key={worker.id}
                    onClick={() => onSign(worker.name)}
                    className="flex flex-col items-center p-4 rounded-2xl border border-neutral-100 hover:border-neutral-400 bg-white hover:bg-neutral-50 shadow-2xs hover:shadow-xs transition duration-200 text-center space-y-3 group"
                  >
                    {/* Avatar */}
                    <div className="relative">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={worker.name}
                          className="size-16 rounded-full object-cover border border-neutral-200 shadow-2xs group-hover:scale-105 transition duration-200"
                        />
                      ) : (
                        <div className="size-16 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center font-serif text-sm font-semibold text-neutral-600 group-hover:scale-105 transition duration-200">
                          {initials}
                        </div>
                      )}
                      
                      {/* Active Status Badge */}
                      {worker.status && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-2xs" />
                      )}
                    </div>

                    <div className="space-y-0.5 min-w-0 w-full">
                      <div className="text-xs font-black uppercase tracking-wider text-neutral-800 truncate">
                        {worker.name.split(" ")[0]}
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
                        {worker.name.split(" ").slice(1).join(" ") || "STAFF"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Fallback override toggle */}
            {!isLoading && activeStaff.length > 0 && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllFallback((curr) => !curr)}
                  className="text-[9px] font-black uppercase tracking-wider text-neutral-400 hover:text-neutral-900 transition"
                >
                  {showAllFallback ? "Mostra solo chi è in turno" : "Non sei in lista? Mostra tutto lo staff"}
                </button>
              </div>
            )}

          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-full border border-neutral-200 hover:border-neutral-400 text-neutral-500 hover:text-neutral-900 text-xs font-black uppercase tracking-wider transition"
          >
            Annulla
          </button>
        </div>

      </div>
    </div>
  );
}
