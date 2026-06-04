"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { 
  Download, 
  Send, 
  Copy, 
  Check, 
  ArrowLeft, 
  MapPin, 
  Smartphone,
  Info
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  code: string;
  color: string;
  textColor: string;
  startTime?: string | null;
  endTime?: string | null;
};

type Employee = {
  id: string;
  name: string;
  role: string;
  sede_id: string | null;
  whatsapp_phone: string | null;
  location?: { name: string } | null;
};

type Location = {
  id: string;
  name: string;
  active: boolean;
};

type CardCell = {
  day?: number;
  entry?: {
    id: string;
    date: string;
    category: Category;
    startTime?: string | null;
    endTime?: string | null;
  };
};

const monthNames = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const weekdays = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

// Helper to convert base64 data URL to Blob synchronously
function dataURItoBlob(dataURI: string) {
  const parts = dataURI.split(",");
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export function ScheduleCardViewer({
  user,
  month,
  year,
  cells,
  uniqueCategories,
  brandingLogoUrl,
  allEmployees = [],
  allLocations = [],
  currentUserRole,
}: {
  user: Employee;
  month: number; // 0-indexed
  year: number;
  cells: CardCell[];
  uniqueCategories: Category[];
  brandingLogoUrl: string | null;
  allEmployees?: Employee[];
  allLocations?: Location[];
  currentUserRole: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // States to allow switching months, locations & employees
  const [selectedLocationId, setSelectedLocationId] = useState<string>(user.sede_id || "ALL");
  const [selectedUserId, setSelectedUserId] = useState(user.id);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedYear, setSelectedYear] = useState(year);

  const canSwitch = currentUserRole !== "DIPENDENTE";

  const [whiteLogoUrl, setWhiteLogoUrl] = useState<string>("/logo.png");

  useEffect(() => {
    const logoSrc = "/logo.png";
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a > 10) {
            // Change color to pure white
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setWhiteLogoUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Canvas pixel color replacement failed:", err);
        setWhiteLogoUrl(logoSrc);
      }
    };
    img.onerror = () => {
      setWhiteLogoUrl(logoSrc);
    };
  }, [brandingLogoUrl]);

  // Filter employees based on the selected location
  const filteredEmployees = useMemo(() => {
    if (selectedLocationId === "ALL") {
      return allEmployees;
    }
    return allEmployees.filter((emp) => emp.sede_id === selectedLocationId);
  }, [allEmployees, selectedLocationId]);

  // Build the copy/share URL
  const getShareUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/schedules/card?userId=${selectedUserId}&month=${selectedMonth + 1}&year=${selectedYear}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copia link fallita:", err);
    }
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      // High-quality export with pixelRatio 3
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#FFFFFF",
        pixelRatio: 3,
        cacheBust: true,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      });

      const link = document.createElement("a");
      const filename = `Turni-${user.name.replace(/\s+/g, "-")}-${monthNames[selectedMonth]}-${selectedYear}.png`;
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Errore generazione immagine:", error);
    } finally {
      setDownloading(false);
    }
  };

  const formatWhatsAppPhone = (phone: string | null) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, ""); // Keep only digits
    if (cleaned.startsWith("39") && cleaned.length >= 11) {
      return cleaned;
    }
    if (cleaned.startsWith("3") && cleaned.length === 10) {
      return "39" + cleaned; // Prepend Italy country code by default
    }
    return cleaned;
  };

  const handleShare = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);

    // 1. Immediately open a blank window to bypass browser popup blockers
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Generazione Cartolina...</title>
            <style>
              body {
                font-family: sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #FAF8F6;
                color: #222124;
              }
              .spinner {
                border: 4px solid rgba(0,0,0,.1);
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border-left-color: #B85B68;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
              }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              h1 { font-size: 18px; font-weight: bold; margin: 0; }
              p { font-size: 14px; color: #666; margin-top: 8px; }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <h1>Generazione cartolina turni in corso...</h1>
            <p>Verrai reindirizzato a WhatsApp a breve.</p>
          </body>
        </html>
      `);
    }

    try {
      const { toPng } = await import("html-to-image");

      let copiedToClipboard = false;
      const cleanPhone = formatWhatsAppPhone(user.whatsapp_phone);
      const waUrl = cleanPhone 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
        : `https://api.whatsapp.com/send`;

      // 2. Bypass async clipboard security block by passing a Promise directly to ClipboardItem
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const imagePromise = toPng(cardRef.current, {
            backgroundColor: "#FFFFFF",
            pixelRatio: 2.5,
            cacheBust: true,
          }).then((dataUrl) => dataURItoBlob(dataUrl));

          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": imagePromise
            })
          ]);
          copiedToClipboard = true;
        } catch (clipboardErr) {
          console.error("Primo tentativo clipboard fallito:", clipboardErr);
          
          // Secondo tentativo (sincrono su blob già generato)
          try {
            const dataUrl = await toPng(cardRef.current, {
              backgroundColor: "#FFFFFF",
              pixelRatio: 2.5,
              cacheBust: true,
            });
            const blob = dataURItoBlob(dataUrl);
            await navigator.clipboard.write([
              new ClipboardItem({
                "image/png": blob
              })
            ]);
            copiedToClipboard = true;
          } catch (err) {
            console.error("Secondo tentativo clipboard fallito:", err);
          }
        }
      }

      // Check if native sharing is available on mobile
      if (navigator.share && navigator.canShare) {
        try {
          const dataUrl = await toPng(cardRef.current, {
            backgroundColor: "#FFFFFF",
            pixelRatio: 2.5,
            cacheBust: true,
          });
          const blob = dataURItoBlob(dataUrl);
          const file = new File(
            [blob],
            `Turni-${user.name.replace(/\s+/g, "-")}-${monthNames[selectedMonth]}.png`,
            { type: "image/png" }
          );

          if (navigator.canShare({ files: [file] })) {
            newWindow?.close();
            await navigator.share({
              files: [file],
              title: `Turni ${user.name}`,
              text: `Ecco la cartolina dei tuoi turni di ${monthNames[selectedMonth]} ${selectedYear}.`,
            });
            setSharing(false);
            return;
          }
        } catch (shareErr) {
          console.error("Condivisione nativa fallita, fallback:", shareErr);
        }
      }

      // 3. Redirect the pre-opened window to WhatsApp
      if (newWindow) {
        newWindow.location.href = waUrl;
      } else {
        window.open(waUrl, "_blank");
      }

      if (copiedToClipboard) {
        alert(
          `Immagine della cartolina copiata negli appunti!\n\nNella chat di WhatsApp che si è aperta, incolla l'immagine (Ctrl+V / Cmd+V o clic destro -> Incolla) e inviala.`
        );
      } else {
        alert(
          `Non è stato possibile copiare l'immagine negli appunti in questo browser.\n\nTi consigliamo di scaricare l'immagine con il tasto 'Scarica PNG' e inviarla manualmente.`
        );
      }

    } catch (error) {
      console.error("Errore condivisione:", error);
      newWindow?.close();
      alert("Si è verificato un errore durante la generazione dei turni.");
    } finally {
      setSharing(false);
    }
  };

  // When dropdowns are used, reload the page with new query params
  const handleFilterChange = (nextUserId: string, nextMonth: number, nextYear: number, nextLocationId: string) => {
    setSelectedUserId(nextUserId);
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
    setSelectedLocationId(nextLocationId);
    window.location.href = `/schedules/card?userId=${nextUserId}&month=${nextMonth + 1}&year=${nextYear}`;
  };

  const handleLocationChange = (nextLocationId: string) => {
    setSelectedLocationId(nextLocationId);
    // Find first employee in this filtered salon
    const nextFiltered = nextLocationId === "ALL" 
      ? allEmployees 
      : allEmployees.filter(emp => emp.sede_id === nextLocationId);
    
    const nextUserId = nextFiltered[0]?.id || selectedUserId;
    handleFilterChange(nextUserId, selectedMonth, selectedYear, nextLocationId);
  };

  const locationName = user.location?.name ?? "Paradise Beauty";

  return (
    <div className="flex flex-col items-center gap-6 p-4 max-w-5xl mx-auto">
      {/* Top action header */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4 no-print border-b border-black/5 pb-4">
        <Button variant="soft" onClick={() => window.history.back()} className="flex items-center gap-2">
          <ArrowLeft className="size-4" /> Indietro
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="soft" onClick={handleCopyLink} className="flex items-center gap-2">
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copied ? "Copiato!" : "Copia Link"}
          </Button>
          <Button variant="soft" onClick={handleDownloadPng} disabled={downloading} className="flex items-center gap-2">
            <Download className={cn("size-4", downloading && "animate-bounce")} />
            {downloading ? "Elaborazione..." : "Scarica PNG"}
          </Button>
          <Button onClick={handleShare} disabled={sharing} className="flex items-center gap-2">
            <Send className={cn("size-4", sharing && "animate-pulse")} />
            {sharing ? "Condivisione..." : "Invia"}
          </Button>
        </div>
      </div>

      {/* Helper text for WhatsApp */}
      <div className="w-full max-w-[460px] no-print rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-start gap-2.5">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Info Invio WhatsApp:</p>
          <p className="mt-1 font-medium leading-relaxed opacity-90">
            Cliccando sul tasto <strong>Invia</strong>, l'immagine della cartolina verrà copiata negli appunti e si aprirà la chat di WhatsApp vuota. Ti basterà fare <strong>Incolla (Ctrl+V / Cmd+V)</strong> per spedire direttamente l'immagine dei turni senza link di testo!
          </p>
        </div>
      </div>

      {/* Admin controls section */}
      {canSwitch && (
        <Card className="w-full max-w-[460px] p-5 border border-black/5 shadow-soft no-print bg-white/70">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
            <Smartphone className="size-3.5" /> Pannello Generazione Cartolina
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {/* Salon Select */}
              <label className="block">
                <span className="text-xs font-bold text-neutral-500 block mb-1">Salone</span>
                <select
                  className="min-h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-paradise-pink"
                  value={selectedLocationId}
                  onChange={(e) => handleLocationChange(e.target.value)}
                >
                  <option value="ALL">Tutti i saloni</option>
                  {allLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Employee Select */}
              <label className="block">
                <span className="text-xs font-bold text-neutral-500 block mb-1">Dipendente</span>
                <select
                  className="min-h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-paradise-pink"
                  value={selectedUserId}
                  onChange={(e) => handleFilterChange(e.target.value, selectedMonth, selectedYear, selectedLocationId)}
                >
                  {filteredEmployees.length === 0 && (
                    <option value="">Nessun dipendente</option>
                  )}
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-bold text-neutral-500 block mb-1">Mese</span>
                <select
                  className="min-h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-paradise-pink"
                  value={selectedMonth}
                  onChange={(e) => handleFilterChange(selectedUserId, Number(e.target.value), selectedYear, selectedLocationId)}
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-neutral-500 block mb-1">Anno</span>
                <select
                  className="min-h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-paradise-pink"
                  value={selectedYear}
                  onChange={(e) => handleFilterChange(selectedUserId, selectedMonth, Number(e.target.value), selectedLocationId)}
                >
                  {[2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* The Printable Visual Card */}
      <div 
        ref={cardRef} 
        id="schedule-card"
        className="w-full max-w-[460px] bg-white rounded-[26px] overflow-hidden shadow-xl border border-neutral-100 flex flex-col font-sans text-neutral-800 antialiased p-0 select-none"
      >
        {/* Dark Top Header */}
        <div className="bg-[#222124] text-white py-5 px-6 text-center flex flex-col items-center justify-center relative">
          <div className="h-9 w-28 mb-1.5 flex items-center justify-center overflow-hidden bg-transparent">
            <img 
              src={whiteLogoUrl} 
              alt="Logo" 
              className="size-full object-contain" 
            />
          </div>
          <h1 className="text-[17px] font-extrabold uppercase tracking-[0.25em] text-white">
            Paradise Beauty
          </h1>
          <p className="text-xs text-white/55 font-semibold tracking-wider mt-1 uppercase">
            Turni · {monthNames[selectedMonth]} {selectedYear}
          </p>
        </div>

        {/* Worker & Location presentation */}
        <div className="text-center pt-6 px-6">
          <h2 className="text-4xl font-extrabold tracking-tight text-[#1a1a1a]">
            {user.name.split(" ")[0]}
          </h2>
          <p className="text-[11px] text-neutral-400 font-bold tracking-widest uppercase mt-2 flex items-center justify-center gap-1">
            <MapPin className="size-3 text-[#B85B68]/60" /> Sede 1 · {locationName}
          </p>
          <div className="w-12 h-[2px] bg-[#B85B68]/30 mx-auto mt-4 rounded-full" />
        </div>

        {/* Calendar Day Header */}
        <div className="px-6 pt-5 pb-2">
          <div className="grid grid-cols-7 gap-2.5 text-center">
            {weekdays.map((day, idx) => {
              const isWeekend = idx >= 5; // Saturday or Sunday
              return (
                <span 
                  key={day} 
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider text-neutral-400",
                    isWeekend && "text-[#B85B68]"
                  )}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </div>

        {/* Calendar Day Grid */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-7 gap-2.5">
            {cells.map((cell, idx) => {
              if (!cell.day) {
                // Empty offset cell
                return <div key={`empty-${idx}`} className="aspect-square bg-transparent" />;
              }

              const hasEntry = !!cell.entry;
              const category = cell.entry?.category;

              // Determine if this day is a weekend day (Saturday or Sunday)
              const cellDate = new Date(selectedYear, selectedMonth, cell.day);
              const isWeekendDay = [6, 0].includes(cellDate.getDay());

              return (
                <div
                  key={`day-${cell.day}`}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-xl text-sm font-semibold border transition-colors duration-200 select-none",
                    hasEntry 
                      ? "border-transparent" 
                      : "border-neutral-100 bg-white text-neutral-700",
                    !hasEntry && isWeekendDay && "text-neutral-500 bg-neutral-50/30"
                  )}
                  style={hasEntry && category ? {
                    backgroundColor: category.color,
                    color: category.textColor || "#1F1F1F"
                  } : undefined}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        {uniqueCategories.length > 0 && (
          <div className="mx-6 py-4 border-t border-neutral-100/70 flex flex-wrap gap-x-4 gap-y-2.5 text-xs font-semibold text-neutral-500">
            {uniqueCategories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <span 
                  className="size-3.5 rounded border border-neutral-200/50 shrink-0" 
                  style={{ backgroundColor: cat.color }}
                />
                <span className="capitalize">
                  {cat.name}
                  {cat.startTime && cat.endTime ? ` (${cat.startTime} - ${cat.endTime})` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Brand Note Banner */}
        <div className="mx-6 mb-5 mt-2 bg-[#FAF0F2] border border-[#B85B68]/10 rounded-2xl p-4 text-center">
          <p className="text-xs font-extrabold text-[#B85B68] tracking-wide">
            Hai bisogno di un giorno di permesso in più?
          </p>
          <p className="text-[10px] text-neutral-500/80 font-medium mt-1 leading-relaxed">
            Comunicalo in anticipo, così ci organizziamo al meglio insieme.
          </p>
        </div>

        {/* Location Footer Subtitle */}
        <div className="text-center pb-6">
          <p className="text-[10px] text-neutral-300 font-bold tracking-widest uppercase italic select-none">
            {locationName}
          </p>
        </div>
      </div>
    </div>
  );
}
