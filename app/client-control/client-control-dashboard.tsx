"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Camera, Check, Download, Edit3, Eye, Search, ShoppingBag, Star, Trash2, X, MessageCircle, AlertTriangle, UserX, Layers, User, Mail, Phone, CalendarDays, Receipt, AtSign, Coins, CreditCard, ChevronDown, ChevronLeft, ChevronRight, Pencil, Sparkles, FileText, ExternalLink, Save, Loader2, RotateCcw, ShieldCheck, ClipboardCheck, Users } from "lucide-react";
import { CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";

type Field = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type ResponseItem = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  answers: Record<string, any>;
  user_location_name: string | null;
  user: { id: string; name: string | null; role: string; photo_url?: string | null };
  form: { id: string; name: string; fields: Field[] };
};

function truthy(value: unknown) {
  if (value === true) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return ["si", "sì", "true", "fatto", "ricevuta", "ok", "1"].includes(text);
}

function namesFromAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
}

function money(value: unknown) {
  const numeric = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(numeric)) return "0,00 €";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(numeric);
}

function answerText(value: unknown) {
  if (value === true) return "Si";
  if (value === false || value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, any>;
    return String(record.name ?? record.url ?? record.storagePath ?? JSON.stringify(record));
  }
  return String(value);
}

function controlStatus(answers: Record<string, any>) {
  return String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "Da controllare").trim();
}

function countsInAnalytics(answers: Record<string, any>) {
  return controlStatus(answers).toLowerCase() !== "errore";
}

function buildAnalytics(responses: ResponseItem[], employeeNames: string[]) {
  const salonMap = new Map<string, {
    salon: string;
    responses: number;
    paid: number;
    staff: Map<string, { name: string; services: number; notePhoto: number; products: number; reviews: number; consulenze: number; checks: number }>;
  }>();

  for (const response of responses) {
    const answers = response.answers ?? {};
    if (!countsInAnalytics(answers)) continue;
    const salon = String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "Senza sede");
    if (!salonMap.has(salon)) {
      salonMap.set(salon, { salon, responses: 0, paid: 0, staff: new Map() });
    }

    const entry = salonMap.get(salon)!;
    entry.responses += 1;
    const paid = Number(String(answers[CLIENT_CONTROL_FIELD_IDS.paid] ?? "0").replace(",", "."));
    if (Number.isFinite(paid)) entry.paid += paid;

    const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
    const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
    const staffNames = (selectedStaff.length ? selectedStaff : fallbackOwner.length ? fallbackOwner : [response.user.name ?? "Senza nome"])
      .map((name) => resolveCanonicalStaffName(name, employeeNames));
    const notePhoto =
      (truthy(answers[CLIENT_CONTROL_FIELD_IDS.notes]) ? 1 : 0) +
      (truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]) ? 1 : 0) +
      (truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]) ? 1 : 0);
    const products = truthy(answers[CLIENT_CONTROL_FIELD_IDS.products]) ? 1 : 0;
    const reviews = truthy(answers[CLIENT_CONTROL_FIELD_IDS.review]) ? 1 : 0;
    const consulenze = String(answers[CLIENT_CONTROL_FIELD_IDS.productsList] || "").toLowerCase().includes("consulenz") ? 1 : 0;

    for (const name of staffNames) {
      const current = entry.staff.get(name) ?? { name, services: 0, notePhoto: 0, products: 0, reviews: 0, consulenze: 0, checks: 0 };
      current.services += consulenze ? 0 : 1;
      current.notePhoto += notePhoto;
      current.products += products;
      current.reviews += reviews;
      current.consulenze += consulenze;
      current.checks += notePhoto + products + reviews + consulenze;
      entry.staff.set(name, current);
    }
  }

  return Array.from(salonMap.values())
    .map((salon) => ({
      ...salon,
      staff: Array.from(salon.staff.values()).sort((a, b) => b.services - a.services || b.checks - a.checks || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.responses - a.responses || a.salon.localeCompare(b.salon));
}

export function ClientControlDashboard({
  initialResponses,
  canDelete,
  employeeNames,
}: {
  initialResponses: ResponseItem[];
  canDelete: boolean;
  employeeNames: string[];
}) {
  const [responses, setResponses] = useState(initialResponses);
  const [query, setQuery] = useState("");
  const [selectedWorkerName, setSelectedWorkerName] = useState("");
  const [currentTabFilter, setCurrentTabFilter] = useState<"all" | "pending" | "discrepancies" | "noshows">("all");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [activeSalon, setActiveSalon] = useState("Tutti");
  const [selected, setSelected] = useState<ResponseItem | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, any>>({});
  const [viewingResponse, setViewingResponse] = useState<any | null>(null);
  const [viewingMetricList, setViewingMetricList] = useState<{ title: string; key: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingResponseId, setUpdatingResponseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const monthsList = [
    { value: 0, label: "Gennaio" },
    { value: 1, label: "Febbraio" },
    { value: 2, label: "Marzo" },
    { value: 3, label: "Aprile" },
    { value: 4, label: "Maggio" },
    { value: 5, label: "Giugno" },
    { value: 6, label: "Luglio" },
    { value: 7, label: "Agosto" },
    { value: 8, label: "Settembre" },
    { value: 9, label: "Ottobre" },
    { value: 10, label: "Novembre" },
    { value: 11, label: "Dicembre" },
  ];

  const yearsList = [2025, 2026, 2027];

  const monthlyResponses = useMemo(() => {
    return responses.filter((r) => {
      const d = new Date(r.created_at);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [responses, selectedMonth, selectedYear]);

  const analyticsResponses = useMemo(() => monthlyResponses.filter((response) => countsInAnalytics(response.answers ?? {})), [monthlyResponses]);
  const salons = useMemo(() => buildAnalytics(monthlyResponses, employeeNames), [employeeNames, monthlyResponses]);
  const allStaff = useMemo(() => {
    const staff = new Map<string, { name: string; services: number; notePhoto: number; products: number; reviews: number; consulenze: number; checks: number }>();
    salons.forEach((salon) => salon.staff.forEach((item) => {
      const current = staff.get(item.name) ?? { name: item.name, services: 0, notePhoto: 0, products: 0, reviews: 0, consulenze: 0, checks: 0 };
      current.services += item.services;
      current.notePhoto += item.notePhoto;
      current.products += item.products;
      current.reviews += item.reviews;
      current.consulenze += item.consulenze;
      current.checks += item.checks;
      staff.set(item.name, current);
    }));
    return Array.from(staff.values()).sort((a, b) => b.services - a.services || b.checks - a.checks);
  }, [salons]);

  const selectedSalon = activeSalon === "Tutti"
    ? { salon: "Tutti i saloni", responses: analyticsResponses.length, paid: salons.reduce((sum, item) => sum + item.paid, 0), staff: allStaff }
    : salons.find((item) => item.salon === activeSalon) ?? { salon: activeSalon, responses: 0, paid: 0, staff: [] };

  const handleDownloadStatement = () => {
    const monthLabel = monthsList.find((m) => m.value === selectedMonth)?.label || "Mese";
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor = [15, 16, 20];
    const accentColor = [243, 155, 209];
    const mutedColor = [110, 110, 115];
    const tableHeaderBg = [255, 241, 245];

    // Header Title Band
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PARADISE HAIR & SPA", 15, 18);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Estratto Conto - Controllo Cliente", 15, 25);
    doc.text(`Periodo: ${monthLabel.toUpperCase()} ${selectedYear}`, 15, 31);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(9);
    doc.text(`Generato il: ${new Date().toLocaleDateString("it-IT")}`, 150, 18);
    doc.text(`Sede: ${activeSalon.toUpperCase()}`, 150, 23);

    // Summary Box
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(15, 50, 180, 25, 3, 3, "F");
    
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("SCHEDE COMPILATE", 20, 57);
    doc.text("INCASSO REGISTRATO", 65, 57);
    doc.text("COLLABORATORI", 115, 57);
    doc.text("CHECK BONUS", 160, 57);

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(selectedSalon?.responses ?? 0), 20, 67);
    doc.text(money(selectedSalon?.paid ?? 0), 65, 67);
    doc.text(String(selectedSalon?.staff.length ?? 0), 115, 67);
    doc.text(String(totalChecks), 160, 67);

    // Section title
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Dettaglio Produttività Collaboratori", 15, 90);

    // Table Headers
    const startY = 96;
    doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
    doc.rect(15, startY, 180, 8, "F");

    doc.setTextColor(198, 97, 112);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    
    doc.text("COLLABORATORE", 18, startY + 5.5);
    doc.text("SERVIZI", 70, startY + 5.5);
    doc.text("NOTE/FOTO", 90, startY + 5.5);
    doc.text("PRODOTTI", 112, startY + 5.5);
    doc.text("RECENSIONI", 134, startY + 5.5);
    doc.text("CONSUL.", 156, startY + 5.5);
    doc.text("BONUS TOT", 175, startY + 5.5);

    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(15, startY + 8, 195, startY + 8);

    let currentY = startY + 8;
    const staffList = selectedSalon?.staff || [];

    if (staffList.length === 0) {
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Nessun dato registrato per questo mese.", 15, currentY + 10);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      staffList.forEach((staff, index) => {
        if (index % 2 === 1) {
          doc.setFillColor(252, 252, 252);
          doc.rect(15, currentY, 180, 8, "F");
        }

        doc.setFont("helvetica", "bold");
        doc.text(staff.name, 18, currentY + 5.5);
        doc.setFont("helvetica", "normal");
        
        doc.text(String(staff.services), 70, currentY + 5.5);
        doc.text(String(staff.notePhoto), 90, currentY + 5.5);
        doc.text(String(staff.products), 112, currentY + 5.5);
        doc.text(String(staff.reviews), 134, currentY + 5.5);
        doc.text(String(staff.consulenze), 156, currentY + 5.5);
        
        doc.setFont("helvetica", "bold");
        doc.text(String(staff.checks), 175, currentY + 5.5);
        doc.setFont("helvetica", "normal");

        doc.line(15, currentY + 8, 195, currentY + 8);
        currentY += 8;

        if (currentY > 270 && index < staffList.length - 1) {
          doc.addPage();
          currentY = 20;
          doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
          doc.rect(15, currentY, 180, 8, "F");
          doc.setTextColor(198, 97, 112);
          doc.setFont("helvetica", "bold");
          doc.text("COLLABORATORE", 18, currentY + 5.5);
          doc.text("SERVIZI", 70, currentY + 5.5);
          doc.text("NOTE/FOTO", 90, currentY + 5.5);
          doc.text("PRODOTTI", 112, currentY + 5.5);
          doc.text("RECENSIONI", 134, currentY + 5.5);
          doc.text("CONSUL.", 156, currentY + 5.5);
          doc.text("BONUS TOT", 175, currentY + 5.5);
          doc.line(15, currentY + 8, 195, currentY + 8);
          currentY += 8;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        }
      });
    }

    const filename = `estratto_conto_${monthLabel.toLowerCase()}_${selectedYear}.pdf`;
    doc.save(filename);
  };

  const workerReport = useMemo(() => {
    if (!selectedWorkerName) return null;

    let totalServices = 0;
    let totalPaid = 0;
    let totalReviews = 0;
    let totalNotePhoto = 0;
    let totalConsulenze = 0;
    const productsMap = new Map<string, number>();

    monthlyResponses.forEach((response) => {
      const answers = response.answers ?? {};
      const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
      const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
      const staffNames = (selectedStaff.length ? selectedStaff : fallbackOwner.length ? fallbackOwner : [response.user.name ?? "Senza nome"])
        .map((name) => resolveCanonicalStaffName(name, employeeNames));

      if (staffNames.includes(selectedWorkerName) && countsInAnalytics(answers)) {
        totalServices++;
        
        const paidVal = Number(String(answers[CLIENT_CONTROL_FIELD_IDS.paid] ?? "0").replace(",", "."));
        if (Number.isFinite(paidVal)) {
          totalPaid += paidVal;
        }

        if (truthy(answers[CLIENT_CONTROL_FIELD_IDS.review])) {
          totalReviews++;
        }

        let notePhotoCount = 0;
        if (truthy(answers[CLIENT_CONTROL_FIELD_IDS.notes])) notePhotoCount++;
        if (truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia])) notePhotoCount++;
        if (truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia])) notePhotoCount++;
        totalNotePhoto += notePhotoCount;

        const prodList = String(answers[CLIENT_CONTROL_FIELD_IDS.productsList] || "").trim();
        if (prodList && prodList !== "undefined" && prodList !== "null") {
          prodList.split(",").forEach((item) => {
            const cleanItem = item.trim();
            if (cleanItem && cleanItem !== "[object Object]") {
              if (cleanItem.toLowerCase().includes("consulenz")) {
                totalConsulenze++;
              }
              productsMap.set(cleanItem, (productsMap.get(cleanItem) ?? 0) + 1);
            }
          });
        }
      }
    });

    const productsList = Array.from(productsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalServices,
      totalPaid,
      totalReviews,
      totalNotePhoto,
      totalConsulenze,
      productsList
    };
  }, [monthlyResponses, selectedWorkerName, employeeNames]);

  const tabCounts = useMemo(() => {
    let all = 0;
    let pending = 0;
    let discrepancies = 0;
    let noshows = 0;

    monthlyResponses.forEach((response) => {
      const answers = response.answers ?? {};
      const salon = String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "Senza sede");

      const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
      const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
      const staffNames = (selectedStaff.length ? selectedStaff : fallbackOwner.length ? fallbackOwner : [response.user.name ?? "Senza nome"])
        .map((name) => resolveCanonicalStaffName(name, employeeNames));

      const matchesWorker = !selectedWorkerName || staffNames.includes(selectedWorkerName);
      const matchesSalon = activeSalon === "Tutti" || salon === activeSalon;

      const haystack = [
        response.user.name,
        salon,
        answers[CLIENT_CONTROL_FIELD_IDS.clientName],
        answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder],
        answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff],
      ].flat().join(" ").toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());

      if (matchesSalon && matchesWorker && matchesQuery) {
        all++;
        const currentStatus = controlStatus(answers).trim().toLowerCase();
        if (!currentStatus || currentStatus === "da controllare") pending++;

        // Mismatch logic
        const declaredPaid = answers[CLIENT_CONTROL_FIELD_IDS.paid];
        const expectedPaid = answers["client_control_shopify_expected_paid"];
        let hasMismatch = false;
        if (
          declaredPaid !== undefined && declaredPaid !== null && declaredPaid !== "" &&
          expectedPaid !== undefined && expectedPaid !== null && expectedPaid !== ""
        ) {
          const declaredNum = parseFloat(String(declaredPaid).replace(",", "."));
          const expectedNum = parseFloat(String(expectedPaid).replace(",", "."));
          if (!Number.isNaN(declaredNum) && !Number.isNaN(expectedNum) && declaredNum !== expectedNum) {
            hasMismatch = true;
          }
        }
        if (hasMismatch) discrepancies++;

        // No Show logic
        const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || "").toLowerCase();
        const isNoShow = correctness === "no show" || 
                         String(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]).toLowerCase() === "no show" || 
                         selectedStaff.some(name => name.toLowerCase() === "no show");
        if (isNoShow) noshows++;
      }
    });

    return { all, pending, discrepancies, noshows };
  }, [monthlyResponses, activeSalon, selectedWorkerName, query, employeeNames]);

  const filteredResponses = monthlyResponses.filter((response) => {
    const answers = response.answers ?? {};
    const salon = String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "Senza sede");

    const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
    const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
    const staffNames = (selectedStaff.length ? selectedStaff : fallbackOwner.length ? fallbackOwner : [response.user.name ?? "Senza nome"])
      .map((name) => resolveCanonicalStaffName(name, employeeNames));

    const matchesWorker = !selectedWorkerName || staffNames.includes(selectedWorkerName);

    // Mismatch logic
    const declaredPaid = answers[CLIENT_CONTROL_FIELD_IDS.paid];
    const expectedPaid = answers["client_control_shopify_expected_paid"];
    let hasMismatch = false;
    if (
      declaredPaid !== undefined && declaredPaid !== null && declaredPaid !== "" &&
      expectedPaid !== undefined && expectedPaid !== null && expectedPaid !== ""
    ) {
      const declaredNum = parseFloat(String(declaredPaid).replace(",", "."));
      const expectedNum = parseFloat(String(expectedPaid).replace(",", "."));
      if (!Number.isNaN(declaredNum) && !Number.isNaN(expectedNum) && declaredNum !== expectedNum) {
        hasMismatch = true;
      }
    }
    
    // No Show logic
    const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || "").toLowerCase();
    const isNoShow = correctness === "no show" || 
                     String(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]).toLowerCase() === "no show" || 
                     selectedStaff.some(name => name.toLowerCase() === "no show");

    // Tab Filter
    let matchesTab = true;
    if (currentTabFilter === "pending") {
      const currentStatus = controlStatus(answers).trim().toLowerCase();
      matchesTab = !currentStatus || currentStatus === "da controllare";
    } else if (currentTabFilter === "discrepancies") {
      matchesTab = hasMismatch;
    } else if (currentTabFilter === "noshows") {
      matchesTab = isNoShow;
    }

    const haystack = [
      response.user.name,
      salon,
      answers[CLIENT_CONTROL_FIELD_IDS.clientName],
      answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder],
      answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff],
    ].flat().join(" ").toLowerCase();
    
    return (activeSalon === "Tutti" || salon === activeSalon) && 
           matchesWorker &&
           matchesTab &&
           haystack.includes(query.trim().toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / pageSize));
  const paginatedResponses = filteredResponses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSalon, currentTabFilter, query, selectedMonth, selectedWorkerName, selectedYear]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function openResponse(response: ResponseItem) {
    setSelected(response);
    setDraftAnswers(response.answers ?? {});
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/service-forms/responses/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: draftAnswers }),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      const updated = await res.json();
      setResponses((prev) => prev.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setSelected((prev) => prev ? { ...prev, ...updated } : prev);
    } catch {
      alert("Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteResponse(response: ResponseItem) {
    if (!window.confirm("Eliminare definitivamente questo Controllo Cliente?")) return;
    const res = await fetch(`/api/service-forms/responses/${response.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Non riesco a eliminare questa scheda.");
      return;
    }
    setResponses((prev) => prev.filter((item) => item.id !== response.id));
    if (selected?.id === response.id) setSelected(null);
  }

  async function updateResponseStatus(response: ResponseItem, newStatus: string) {
    const answers = response.answers ?? {};
    setUpdatingResponseId(response.id);
    try {
      const res = await fetch(`/api/service-forms/responses/${response.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: {
            ...answers,
            [CLIENT_CONTROL_FIELD_IDS.correctness]: newStatus,
          },
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setResponses((prev) => prev.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    } catch {
      alert("Errore durante l'aggiornamento dello stato.");
    } finally {
      setUpdatingResponseId(null);
    }
  }

  const hasActiveFilters = activeSalon !== "Tutti" || Boolean(selectedWorkerName) || Boolean(query.trim()) || currentTabFilter !== "all";

  function resetOperationalFilters() {
    setActiveSalon("Tutti");
    setSelectedWorkerName("");
    setQuery("");
    setCurrentTabFilter("all");
  }

  const maxServices = Math.max(...(selectedSalon?.staff ?? []).map((staff) => staff.services), 1);
  const totalChecks = selectedSalon?.staff.reduce((sum, staff) => sum + staff.checks, 0) ?? 0;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-black/10 bg-[#111114] text-white shadow-[0_20px_55px_rgba(0,0,0,0.14)]">
        <div className="grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[0.07] text-[#F39BD1]">
                <ShieldCheck className="size-5" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#F39BD1]">Qualità e controllo operativo</p>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight lg:text-[42px]">Controllo Cliente</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/60">
              Verifica pagamenti, documentazione e qualità del servizio da un unico pannello.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Tutti", ...salons.map((salon) => salon.salon)].map((salon) => (
                <button
                  key={salon}
                  type="button"
                  onClick={() => setActiveSalon(salon)}
                  className={cn(
                    "rounded-md border px-3.5 py-2 text-xs font-black transition",
                    activeSalon === salon ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.05] text-white/65 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {salon}
                </button>
              ))}
            </div>
            
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/50">Mese:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="rounded-md border border-white/10 bg-[#1c1d24] px-3 py-2 text-xs font-black text-white outline-none transition hover:bg-white/10"
                >
                  {monthsList.map((m) => (
                    <option key={m.value} value={m.value} className="bg-[#1c1d24] text-white">
                      {m.label.toUpperCase()}
                    </option>
                  ))}
                </select>
                
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-md border border-white/10 bg-[#1c1d24] px-3 py-2 text-xs font-black text-white outline-none transition hover:bg-white/10"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y} className="bg-[#1c1d24] text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleDownloadStatement}
                className="ml-auto flex items-center gap-2 rounded-md bg-[#F39BD1] px-4 py-2.5 text-xs font-black text-black shadow-sm transition hover:bg-[#f5add8]"
              >
                <Download className="size-3.5" />
                Scarica Estratto Conto PDF
              </button>
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
            {[
              { label: "Schede", value: selectedSalon?.responses ?? 0, icon: ClipboardCheck },
              { label: "Incasso registrato", value: money(selectedSalon?.paid ?? 0), icon: CreditCard },
              { label: "Collaboratori", value: selectedSalon?.staff.length ?? 0, icon: Users },
              { label: "Da controllare", value: tabCounts.pending, icon: AlertTriangle, urgent: true },
            ].map((card) => (
              <div key={card.label} className={cn("bg-[#202024] p-4", card.urgent && tabCounts.pending > 0 && "bg-[#2b211b]")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/42">{card.label}</p>
                  <card.icon className={cn("size-4 text-white/35", card.urgent && tabCounts.pending > 0 && "text-amber-400")} />
                </div>
                <p className="mt-2 text-2xl font-black">{card.value}</p>
                {card.urgent && tabCounts.pending > 0 ? <p className="mt-1 text-[10px] font-bold text-amber-300/75">Richiedono verifica</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]">Bonus produttivita</p>
              <h2 className="text-2xl font-black">{selectedSalon?.salon ?? "Nessun dato"}</h2>
            </div>
            <BarChart3 className="size-6 text-[#E88AC5]" />
          </div>
          <div className="space-y-3">
            {(selectedSalon?.staff ?? []).slice(0, 12).map((staff) => (
              <div key={staff.name} className="grid grid-cols-[minmax(120px,220px)_1fr_44px] items-center gap-3">
                <p className="truncate text-sm font-bold text-black/70">{staff.name}</p>
                <div className="h-3 overflow-hidden rounded-full bg-[#F7DFEB]">
                  <div className="h-full rounded-full bg-[#E88AC5]" style={{ width: `${Math.max(6, (staff.services / maxServices) * 100)}%` }} />
                </div>
                <p className="text-right text-sm font-black">{staff.services}</p>
              </div>
            ))}
            {!selectedSalon?.staff.length ? <p className="rounded-2xl bg-black/[0.03] p-4 text-sm font-bold text-black/40">Nessun controllo cliente registrato.</p> : null}
          </div>
        </div>

        <div className="grid gap-4">
          {[
            { title: "Note & foto", key: "notePhoto" as const, gradient: "from-[#D29BFD] to-[#8C3FD6]", glow: "rgba(210,155,253,0.35)", icon: Camera },
            { title: "Recensioni", key: "reviews" as const, gradient: "from-[#7ABAFE] to-[#2563EB]", glow: "rgba(122,186,254,0.35)", icon: Star },
            { title: "Prodotti", key: "products" as const, gradient: "from-[#64D2E1] to-[#0D9488]", glow: "rgba(100,210,225,0.35)", icon: ShoppingBag },
            { title: "Consulenze", key: "consulenze" as const, gradient: "from-[#FFB56B] to-[#F97316]", glow: "rgba(249,115,22,0.35)", icon: MessageCircle },
          ].map((metric) => {
            const rows = (selectedSalon?.staff ?? []).filter((staff) => staff[metric.key] > 0).slice(0, 4);
            const max = Math.max(...rows.map((row) => row[metric.key]), 1);
            const Icon = metric.icon;
            return (
              <div 
                key={metric.key} 
                onClick={() => setViewingMetricList({ title: metric.title, key: metric.key })}
                className="cursor-pointer rounded-[28px] border border-black/[0.06] bg-gradient-to-br from-white to-neutral-50/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_40px_rgba(234,140,205,0.08)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-neutral-100/50 rounded-bl-full pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-lg bg-black/[0.03] text-neutral-600 group-hover:bg-[#EA8CCD]/10 group-hover:text-[#C661A0] transition-colors duration-300">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 group-hover:text-neutral-500 transition-colors duration-300">{metric.title}</p>
                </div>
                
                <div className="mt-6 flex h-28 items-end gap-4 relative border-b border-black/[0.04] pb-2">
                  {/* Grid lines in background */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2 opacity-50">
                    <div className="border-t border-dashed border-black/[0.04] w-full h-0" />
                    <div className="border-t border-dashed border-black/[0.04] w-full h-0" />
                    <div className="border-t border-dashed border-black/[0.04] w-full h-0" />
                  </div>

                  {rows.length ? rows.map((row) => (
                    <div key={row.name} className="flex flex-1 flex-col items-center gap-1.5 min-w-0 z-10">
                      <span className="text-[11px] font-black text-neutral-800">{row[metric.key]}</span>
                      <div 
                        className={cn("w-7 rounded-t-lg bg-gradient-to-t transition-all duration-500 group-hover:scale-y-[1.03] origin-bottom", metric.gradient)} 
                        style={{ 
                          height: `${Math.max(16, (row[metric.key] / max) * 76)}px`,
                          boxShadow: `0 4px 12px ${metric.glow}`
                        }} 
                      />
                      <span className="max-w-full truncate text-[9px] font-black tracking-tight text-neutral-400 group-hover:text-neutral-600 transition-colors duration-300">{row.name}</span>
                    </div>
                  )) : (
                    <div className="grid h-full flex-1 place-items-center text-xs font-bold text-neutral-300 pb-2 z-10">
                      Nessun dato registrato
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-black/10 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]">Registro operativo</p>
            <h2 className="mt-1 text-2xl font-black">Controlli cliente</h2>
            <p className="mt-1 text-xs font-semibold text-black/45">
              {filteredResponses.length} schede corrispondono ai filtri selezionati
            </p>
          </div>
          <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row lg:max-w-3xl">
            <select
              value={selectedWorkerName}
              onChange={(e) => setSelectedWorkerName(e.target.value)}
              className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm font-semibold outline-none transition hover:bg-neutral-50 focus:border-[#D66CA8]"
            >
              <option value="">Tutti i collaboratori</option>
              {employeeNames.slice().sort((a, b) => a.localeCompare(b)).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-black/10 bg-white px-3 transition focus-within:border-[#D66CA8] focus-within:ring-2 focus-within:ring-[#F39BD1]/15">
              <Search className="size-4 text-black/35" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca cliente, staff, ordine..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="grid size-7 place-items-center rounded-md text-black/35 transition hover:bg-black/5 hover:text-black" aria-label="Cancella ricerca">
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>
            {hasActiveFilters ? (
              <button type="button" onClick={resetOperationalFilters} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-black/10 px-3 text-xs font-black text-black/55 transition hover:bg-black hover:text-white">
                <RotateCcw className="size-3.5" />
                Azzera
              </button>
            ) : null}
          </div>
        </div>
        
        {/* Modern Tab Filter Segmented Control */}
        <div className="border-b border-black/5 bg-[#faf8f9] p-3 sm:px-5">
          <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-black/[0.05] bg-white p-1 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setCurrentTabFilter("all")}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-black transition duration-200",
                currentTabFilter === "all"
                  ? "bg-black text-white shadow-sm"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-black"
              )}
            >
              <Layers className={cn("size-3.5", currentTabFilter === "all" ? "text-neutral-800" : "text-neutral-400")} />
              Tutti i moduli ({tabCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setCurrentTabFilter("pending")}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-black transition duration-200",
                currentTabFilter === "pending"
                  ? "bg-amber-100 text-amber-900 shadow-sm"
                  : "text-neutral-500 hover:bg-amber-50 hover:text-amber-700"
              )}
            >
              <AlertTriangle className={cn("size-3.5", currentTabFilter === "pending" ? "text-amber-600" : "text-neutral-400")} />
              Da controllare ({tabCounts.pending})
            </button>
            <button
              type="button"
              onClick={() => setCurrentTabFilter("discrepancies")}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-black transition duration-200",
                currentTabFilter === "discrepancies"
                  ? "bg-red-100 text-red-700 shadow-sm"
                  : "text-neutral-500 hover:bg-red-50 hover:text-red-600"
              )}
            >
              <AlertTriangle className={cn("size-3.5", currentTabFilter === "discrepancies" ? "text-red-500" : "text-neutral-400")} />
              Discrepanze ({tabCounts.discrepancies})
            </button>
            <button
              type="button"
              onClick={() => setCurrentTabFilter("noshows")}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-black transition duration-200",
                currentTabFilter === "noshows"
                  ? "bg-[#FCE7F3] text-[#A83E76] shadow-sm"
                  : "text-neutral-500 hover:bg-[#FFF2F8] hover:text-[#C661A0]"
              )}
            >
              <UserX className={cn("size-3.5", currentTabFilter === "noshows" ? "text-[#C661A0]" : "text-neutral-400")} />
              No Show ({tabCounts.noshows})
            </button>
          </div>
        </div>

        {workerReport && (
          <div className="mx-5 mb-5 p-5 rounded-[24px] bg-[#FAF6F9]/60 border border-black/[0.05] space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/[0.05] pb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C661A0]">REPORT MENSILE COLLABORATORE</p>
                <h3 className="text-xl font-black text-neutral-800">{selectedWorkerName}</h3>
              </div>
              <button 
                onClick={() => setSelectedWorkerName("")}
                className="text-xs text-neutral-500 hover:text-black font-semibold underline self-start sm:self-center"
              >
                Azzera filtro collaboratore
              </button>
            </div>

            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              {[
                { label: "Servizi svolti", value: workerReport.totalServices },
                { label: "Valore servizi", value: money(workerReport.totalPaid) },
                { label: "Recensioni ricevute", value: workerReport.totalReviews },
                { label: "Note e Foto fatte", value: workerReport.totalNotePhoto },
                { label: "Consulenze fatte", value: workerReport.totalConsulenze },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-black/[0.03] bg-white p-4 shadow-sm">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-neutral-400 leading-tight">{card.label}</p>
                  <p className="mt-2 text-lg font-black text-neutral-800">{card.value}</p>
                </div>
              ))}
            </div>

            {workerReport.productsList.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-black/[0.04] pb-1.5 mt-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C661A0]">Dettaglio Prodotti / Servizi Venduti (da Shopify)</p>
                  {workerReport.productsList.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllProducts(prev => !prev)}
                      className="text-[10px] font-bold text-neutral-500 hover:text-black transition underline cursor-pointer select-none"
                    >
                      {showAllProducts ? "Mostra meno" : `Mostra tutti (${workerReport.productsList.length})`}
                    </button>
                  )}
                </div>
                
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(showAllProducts ? workerReport.productsList : workerReport.productsList.slice(0, 6)).map((prod) => (
                    <div key={prod.name} className="flex items-center justify-between rounded-xl border border-black/[0.04] bg-white p-2.5 shadow-sm text-xs font-semibold text-neutral-700 hover:border-black/[0.08] transition duration-150">
                      <span className="truncate pr-2" title={prod.name}>{prod.name}</span>
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[#F39BD1]/10 px-1.5 text-[#C661A0] font-black text-[10px] shrink-0">
                        {prod.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">Nessun prodotto registrato per questo collaboratore nel mese selezionato.</p>
            )}
          </div>
        )}

        <div className="grid gap-3 p-4 lg:hidden">
          {paginatedResponses.map((response) => {
            const answers = response.answers ?? {};
            const status = controlStatus(answers);
            const checks = [
              truthy(answers[CLIENT_CONTROL_FIELD_IDS.notes]),
              truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]),
              truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]),
              truthy(answers[CLIENT_CONTROL_FIELD_IDS.products]),
              truthy(answers[CLIENT_CONTROL_FIELD_IDS.review]),
            ].filter(Boolean).length;
            const staff = namesFromAnswer(
              answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff] ||
              answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner] ||
              response.user.name,
            ).map((name) => resolveCanonicalStaffName(name, employeeNames));

            return (
              <article key={response.id} className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
                <div className={cn(
                  "h-1 w-full",
                  status.toLowerCase() === "errore" ? "bg-red-500" : status.toLowerCase() === "controllato" ? "bg-emerald-500" : "bg-amber-400",
                )} />
                <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B94778]">
                      {new Date(response.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <h3 className="mt-1 truncate text-lg font-black text-[#171717]">
                      {answerText(answers[CLIENT_CONTROL_FIELD_IDS.clientName])}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-black/45">
                      Ordine {answerText(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder])} · {answerText(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name)}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black",
                    checks === 5 ? "bg-emerald-50 text-emerald-700" : checks >= 3 ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-500",
                  )}>
                    {checks}/5 check
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-black/5 bg-[#FAF7F9] p-3">
                    <p className="font-black uppercase tracking-wide text-black/35">Pagamento</p>
                    <p className="mt-1 text-sm font-black text-black">{money(answers[CLIENT_CONTROL_FIELD_IDS.paid])}</p>
                    <p className="mt-0.5 font-semibold text-black/45">Acconto {money(answers[CLIENT_CONTROL_FIELD_IDS.depositPaid])}</p>
                  </div>
                  <div className="rounded-md border border-black/5 bg-[#FAF7F9] p-3">
                    <p className="font-black uppercase tracking-wide text-black/35">Collaboratrice</p>
                    <p className="mt-1 line-clamp-2 text-sm font-black text-black">{staff.join(", ") || "Non assegnata"}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <select
                      value={status}
                      disabled={updatingResponseId === response.id}
                      onChange={(event) => void updateResponseStatus(response, event.target.value)}
                      className={cn(
                        "h-11 w-full rounded-md border px-3 pr-9 text-xs font-black outline-none disabled:opacity-60",
                        status.toLowerCase() === "errore"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : status.toLowerCase() === "controllato"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700",
                      )}
                    >
                      <option value="Da controllare">Da controllare</option>
                      <option value="Controllato">Controllato</option>
                      <option value="Errore">Errore</option>
                    </select>
                    {updatingResponseId === response.id ? <Loader2 className="absolute right-3 top-3.5 size-4 animate-spin" /> : null}
                  </div>
                  <button type="button" onClick={() => setViewingResponse(response)} className="grid size-11 shrink-0 place-items-center rounded-md bg-black text-white transition active:scale-95" aria-label="Visualizza dettagli"><Eye className="size-4" /></button>
                  <button type="button" onClick={() => openResponse(response)} className="grid size-11 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-black transition active:scale-95" aria-label="Modifica controllo"><Edit3 className="size-4" /></button>
                  {canDelete ? <button type="button" onClick={() => deleteResponse(response)} className="grid size-11 shrink-0 place-items-center rounded-md border border-red-100 bg-red-50 text-red-600 transition active:scale-95" aria-label="Elimina controllo"><Trash2 className="size-4" /></button> : null}
                </div>
                </div>
              </article>
            );
          })}
          {!filteredResponses.length ? <p className="p-8 text-center text-sm font-bold text-black/40">Nessun modulo trovato.</p> : null}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#fbf7fa] text-[10px] uppercase tracking-[0.18em] text-black/42">
              <tr>
                <th className="px-5 py-4">Data</th>
                <th className="px-5 py-4">Cliente</th>
                <th className="px-5 py-4">Sede</th>
                <th className="px-5 py-4">Staff</th>
                <th className="px-5 py-4">Pagamento</th>
                <th className="px-5 py-4">Check</th>
                <th className="px-5 py-4">Stato</th>
                <th className="px-5 py-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {paginatedResponses.map((response) => {
                const answers = response.answers ?? {};
                const checks = [
                  truthy(answers[CLIENT_CONTROL_FIELD_IDS.notes]),
                  truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]),
                  truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]),
                  truthy(answers[CLIENT_CONTROL_FIELD_IDS.products]),
                  truthy(answers[CLIENT_CONTROL_FIELD_IDS.review]),
                ].filter(Boolean).length;
                const status = controlStatus(answers);
                return (
                  <tr key={response.id} className="border-t border-black/5 align-top hover:bg-[#fff7fc]">
                    <td className="px-5 py-4 font-semibold text-black/55">{new Date(response.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-4">
                      <p className="font-black">{answerText(answers[CLIENT_CONTROL_FIELD_IDS.clientName])}</p>
                      <div className="mt-1 flex flex-col gap-0.5 text-xs font-semibold text-black/40">
                        {answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] ? <p>Ordine: {answerText(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder])}</p> : null}
                        {answers[CLIENT_CONTROL_FIELD_IDS.email] ? <p>Email: {answerText(answers[CLIENT_CONTROL_FIELD_IDS.email])}</p> : null}
                        {answers[CLIENT_CONTROL_FIELD_IDS.phone] ? <p>Tel: {answerText(answers[CLIENT_CONTROL_FIELD_IDS.phone])}</p> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-black/62">{answerText(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name)}</td>
                    <td className="px-5 py-4 max-w-[240px]">
                      <p className="line-clamp-2 font-bold text-black/65">
                        {answerText(
                          namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff] || answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner] || response.user.name)
                            .map((name) => resolveCanonicalStaffName(name, employeeNames))
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-black">{money(answers[CLIENT_CONTROL_FIELD_IDS.paid])}</p>
                      <p className="text-xs font-semibold text-black/40">Acconto {money(answers[CLIENT_CONTROL_FIELD_IDS.depositPaid])}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 select-none">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide border",
                            checks === 5 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" 
                              : checks >= 3 
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-700" 
                              : "bg-neutral-100 border-neutral-200 text-neutral-500"
                          )}>
                            {checks}/5
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {[
                            { label: "N", active: truthy(answers[CLIENT_CONTROL_FIELD_IDS.notes]), title: "Note" },
                            { label: "FP", active: truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]), title: "Foto Prima" },
                            { label: "FD", active: truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]), title: "Foto Dopo" },
                            { label: "PR", active: truthy(answers[CLIENT_CONTROL_FIELD_IDS.products]), title: "Prodotti" },
                            { label: "RC", active: truthy(answers[CLIENT_CONTROL_FIELD_IDS.review]), title: "Recensione" },
                          ].map((ind, i) => (
                            <span
                              key={i}
                              title={ind.title}
                              className={cn(
                                "text-[8px] font-black px-1.5 py-0.5 rounded border tracking-wide transition-all",
                                ind.active
                                  ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-700 font-extrabold"
                                  : "bg-neutral-50 border-neutral-100 text-neutral-300 dark:border-white/5"
                              )}
                            >
                              {ind.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={status}
                        disabled={updatingResponseId === response.id}
                        onChange={(e) => void updateResponseStatus(response, e.target.value)}
                        className={cn(
                          "cursor-pointer rounded-md border px-3 py-2 pr-7 text-xs font-black outline-none appearance-none bg-no-repeat bg-[right_8px_center] disabled:cursor-wait disabled:opacity-60",
                          status.toLowerCase() === "errore"
                            ? "border-red-100 bg-red-50 text-red-700"
                            : status.toLowerCase() === "controllato"
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                            : "border-amber-100 bg-amber-50 text-amber-700"
                        )}
                        style={{
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                          backgroundSize: '10px',
                        }}
                      >
                        <option value="Da controllare">Da controllare</option>
                        <option value="Controllato">Controllato</option>
                        <option value="Errore">Errore</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setViewingResponse(response)} className="grid size-9 place-items-center rounded-md bg-black text-white transition hover:bg-black/80" title="Visualizza ordine e dettagli"><Eye className="size-4" /></button>
                        <button type="button" onClick={() => openResponse(response)} className="grid size-9 place-items-center rounded-md border border-black/10 bg-white text-black transition hover:bg-[#fff2f8]" title="Modifica"><Edit3 className="size-4" /></button>
                        {canDelete ? <button type="button" onClick={() => deleteResponse(response)} className="grid size-9 place-items-center rounded-md border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100" title="Elimina"><Trash2 className="size-4" /></button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredResponses.length ? <p className="p-8 text-center text-sm font-bold text-black/40">Nessun modulo trovato.</p> : null}
        </div>

        {filteredResponses.length ? (
          <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-black/45">
              Risultati {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredResponses.length)} di {filteredResponses.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="grid size-10 place-items-center rounded-full border border-black/10 bg-white text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Pagina precedente"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-24 text-center text-xs font-black text-black/65">
                Pagina {currentPage} di {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="grid size-10 place-items-center rounded-full border border-black/10 bg-white text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Pagina successiva"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-black/10 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.25)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-black/5 bg-white/95 px-6 pt-7 pb-5 sm:px-8">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xs">
                  Modifica Controllo
                </span>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#1F1F1F] sm:text-4xl">
                  {String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.clientName] || "Cliente")}
                </h2>
                <p className="mt-1 text-xs font-semibold text-black/50">
                  Compilato da <span className="font-bold text-black/75">{selected.user.name ?? "Dipendente"}</span> il {new Date(selected.created_at).toLocaleString("it-IT")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-black/10 bg-neutral-50 text-black/70 shadow-2xs transition hover:bg-neutral-100 active:scale-95"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8 space-y-6">
              {/* Info cliente Card */}
              <section className="rounded-[28px] border border-[#F9D5E7] bg-gradient-to-br from-[#FFF7FB] via-[#FFF0F6] to-[#FFEBF4] p-5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-black/60">
                  <User className="size-4 text-[#D96B94]" />
                  <span className="uppercase tracking-wider font-black text-[11px] text-[#B83D7F]">Info cliente da</span>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-[#F6C6DE] bg-white/90 backdrop-blur-xs px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                    <Receipt className="size-3.5 text-[#D96B94]" />
                    <span>N° acconto: #{String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || "---")}</span>
                  </span>
                  {draftAnswers[CLIENT_CONTROL_FIELD_IDS.email] ? (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-[#F6C6DE] bg-white/90 backdrop-blur-xs px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                      <Mail className="size-3.5 text-[#D96B94]" />
                      <span className="truncate max-w-[200px]">{String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.email])}</span>
                    </span>
                  ) : null}
                  {draftAnswers[CLIENT_CONTROL_FIELD_IDS.phone] ? (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-[#F6C6DE] bg-white/90 backdrop-blur-xs px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                      <Phone className="size-3.5 text-[#D96B94]" />
                      <span>{String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.phone])}</span>
                    </span>
                  ) : null}
                  {draftAnswers[CLIENT_CONTROL_FIELD_IDS.productsList] ? (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-[#F6C6DE] bg-white/90 backdrop-blur-xs px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                      <CalendarDays className="size-3.5 text-[#D96B94]" />
                      <span className="truncate max-w-[280px]">{String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.productsList])}</span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-[#F6C6DE] bg-white/90 backdrop-blur-xs px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                    <AtSign className="size-3.5 text-[#D96B94]" />
                    <input
                      type="text"
                      value={String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.instagramTag] ?? "")}
                      onChange={(e) =>
                        setDraftAnswers((prev) => ({
                          ...prev,
                          [CLIENT_CONTROL_FIELD_IDS.instagramTag]: e.target.value,
                        }))
                      }
                      placeholder="@cliente"
                      className="bg-transparent outline-none w-24 text-xs font-black text-[#D96B94]"
                    />
                  </span>
                </div>
              </section>

              {/* 1° e 2° Ordine Shopify Card */}
              <div className="rounded-[28px] border border-[#F6C6DE] bg-[#FFF8FB] p-4 sm:p-5 space-y-3 relative shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#D96B94]">
                    <ShoppingBag className="size-4 text-[#D96B94]" /> ORDINI SHOPIFY (1° ACCONTO / 2° SALDO)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[9px] font-black uppercase text-black/50 mb-1">1° Ordine (Acconto)</span>
                    <input
                      type="text"
                      value={String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] ?? "")}
                      onChange={(event) =>
                        setDraftAnswers((prev) => ({
                          ...prev,
                          [CLIENT_CONTROL_FIELD_IDS.shopifyOrder]: event.target.value,
                        }))
                      }
                      className="h-12 w-full rounded-2xl border border-[#F4D3E2] bg-white px-4 text-xs font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition shadow-2xs"
                      placeholder="N° Acconto"
                    />
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase text-black/50 mb-1">2° Ordine (Saldo / Salone)</span>
                    <input
                      type="text"
                      value={String(draftAnswers.second_shopify_order ?? "")}
                      onChange={(event) =>
                        setDraftAnswers((prev) => ({
                          ...prev,
                          second_shopify_order: event.target.value,
                        }))
                      }
                      className="h-12 w-full rounded-2xl border border-[#F4D3E2] bg-white px-4 text-xs font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition shadow-2xs"
                      placeholder="N° Saldo (es. 25270)"
                    />
                  </div>
                </div>
              </div>

              {/* Acconto, Pagato & Collaboratrice Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/50 mb-1">
                    <Coins className="size-3.5 text-[#D96B94]" /> ACCONTO PAGATO (€)
                  </span>
                  <input
                    type="text"
                    value={String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.depositPaid] ?? "")}
                    onChange={(event) =>
                      setDraftAnswers((prev) => ({
                        ...prev,
                        [CLIENT_CONTROL_FIELD_IDS.depositPaid]: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[#F4D3E2] bg-white px-4 text-xs font-bold text-[#1F1F1F] outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition shadow-2xs"
                    placeholder="0.00"
                  />
                </label>

                <label className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/50 mb-1">
                    <CreditCard className="size-3.5 text-[#D96B94]" /> PAGATO (€)
                  </span>
                  <input
                    type="text"
                    value={String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.paid] ?? "")}
                    onChange={(event) =>
                      setDraftAnswers((prev) => ({
                        ...prev,
                        [CLIENT_CONTROL_FIELD_IDS.paid]: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[#F4D3E2] bg-white px-4 text-xs font-bold text-[#1F1F1F] outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition shadow-2xs"
                    placeholder="0.00"
                  />
                </label>

                <div className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/50 mb-1">
                    <User className="size-3.5 text-[#D96B94]" /> COLLABORATRICE
                  </span>
                  <input
                    type="text"
                    value={Array.isArray(draftAnswers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]) ? draftAnswers[CLIENT_CONTROL_FIELD_IDS.serviceStaff].join(", ") : String(draftAnswers[CLIENT_CONTROL_FIELD_IDS.serviceStaff] ?? draftAnswers[CLIENT_CONTROL_FIELD_IDS.serviceOwner] ?? "")}
                    onChange={(event) =>
                      setDraftAnswers((prev) => ({
                        ...prev,
                        [CLIENT_CONTROL_FIELD_IDS.serviceStaff]: event.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[#F4D3E2] bg-white px-4 text-xs font-bold text-[#1F1F1F] outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition shadow-2xs"
                    placeholder="Nome collaboratrice..."
                  />
                </div>
              </div>

              {/* NOTA SHOPIFY (Read-only) */}
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-black/50">
                  <FileText className="size-4 text-[#D96B94]" /> NOTA SHOPIFY COMPILATA
                </span>
                <textarea
                  value={String(draftAnswers.client_control_shopify_order_note || draftAnswers.custom_note_text || draftAnswers.customNoteText || "")}
                  readOnly={true}
                  rows={3}
                  className="mt-1.5 w-full rounded-2xl border border-[#F4D3E2] bg-neutral-50 p-4 text-xs font-bold text-[#1F1F1F] shadow-2xs outline-none cursor-not-allowed select-none"
                  placeholder="Nota Shopify compilata per questo ordine..."
                />
              </div>

              {/* Verifiche e Controlli Checkboxes */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                  VERIFICHE E CONTROLLI
                </span>
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  {[
                    [CLIENT_CONTROL_FIELD_IDS.notes, "Note Shopify"],
                    [CLIENT_CONTROL_FIELD_IDS.beforeMedia, "Prima foto/video"],
                    [CLIENT_CONTROL_FIELD_IDS.afterMedia, "Dopo foto/video"],
                    [CLIENT_CONTROL_FIELD_IDS.products, "Prodotti"],
                    [CLIENT_CONTROL_FIELD_IDS.review, "Recensione"],
                  ].map(([fieldKey, fieldLabel]) => {
                    const checked = truthy(draftAnswers[fieldKey]);
                    return (
                      <button
                        key={fieldKey}
                        type="button"
                        onClick={() =>
                          setDraftAnswers((prev) => ({
                            ...prev,
                            [fieldKey]: !truthy(prev[fieldKey]),
                          }))
                        }
                        className={[
                          "flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition active:scale-95 shadow-2xs",
                          checked
                            ? "border-[#D96B94] bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-xs"
                            : "border-black/10 bg-white text-black/70 hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        <span className={`grid size-4 place-items-center rounded-md border ${checked ? "border-white bg-white text-[#D96B94]" : "border-black/20"}`}>
                          {checked && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span>{fieldLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-black/5 bg-white/95 px-6 py-5 sm:px-8">
              <div>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => deleteResponse(selected)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-6 py-3.5 text-xs font-black text-red-600 border border-red-200 transition hover:bg-red-100 active:scale-95"
                  >
                    <Trash2 className="size-4" /> Elimina
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-2xl border border-black/10 bg-neutral-100 px-7 py-3.5 text-xs font-black text-black/70 transition hover:bg-neutral-200 active:scale-95"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={saveSelected}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-8 py-3.5 text-xs font-black text-white shadow-md transition hover:opacity-95 active:scale-95 disabled:opacity-60"
                >
                  <Save className="size-4" />
                  <span>{saving ? "Salvataggio..." : "Salva modifiche"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewingMetricList ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-6 bg-[#FAF6F9]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]">Dettaglio Statistiche</p>
                <h3 className="text-2xl font-black text-black/80">{viewingMetricList.title}</h3>
                <p className="mt-1 text-xs font-semibold text-black/40">
                  {monthsList.find((m) => m.value === selectedMonth)?.label} {selectedYear} • {activeSalon}
                </p>
              </div>
              <button type="button" onClick={() => setViewingMetricList(null)} className="grid size-11 place-items-center rounded-full bg-black/[0.04] text-black/60 hover:bg-black/[0.08] transition"><X className="size-5" /></button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1 bg-white">
              <div className="grid gap-3">
                {analyticsResponses.filter((response) => {
                  const answers = response.answers ?? {};
                  const salon = String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "Senza sede");
                  if (activeSalon !== "Tutti" && salon !== activeSalon) return false;
                  
                  if (viewingMetricList.key === "notePhoto") return truthy(answers[CLIENT_CONTROL_FIELD_IDS.notes]) || truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]) || truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]);
                  if (viewingMetricList.key === "products") return truthy(answers[CLIENT_CONTROL_FIELD_IDS.products]);
                  if (viewingMetricList.key === "reviews") return truthy(answers[CLIENT_CONTROL_FIELD_IDS.review]);
                  if (viewingMetricList.key === "consulenze") return String(answers[CLIENT_CONTROL_FIELD_IDS.productsList] || "").toLowerCase().includes("consulenz");
                  return false;
                }).map((response) => {
                  const answers = response.answers ?? {};
                  return (
                    <div key={response.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-black/5 hover:border-black/10 hover:bg-[#FAF6F9]/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-black text-sm">{answerText(answers[CLIENT_CONTROL_FIELD_IDS.clientName])}</p>
                          <span className="text-[10px] font-bold text-black/40 bg-black/5 px-2 py-0.5 rounded-full">
                            {new Date(response.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-black/50">
                          Staff: <span className="text-black/70">
                            {answerText(namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff] || answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner] || response.user.name).map((name) => resolveCanonicalStaffName(name, employeeNames)))}
                          </span>
                        </p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setViewingResponse(response)} 
                        className="bg-black/5 hover:bg-black/10 text-black text-xs font-bold px-4 py-2 rounded-xl transition whitespace-nowrap"
                      >
                        Apri Controllo
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewingResponse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-6 bg-[#FAF6F9]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]">Dettagli Controllo & Ordine</p>
                <h3 className="text-2xl font-black text-black/80">{answerText(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.clientName])}</h3>
                <p className="mt-1 text-xs font-semibold text-black/40">
                  Registrato il {new Date(viewingResponse.created_at).toLocaleString("it-IT")} da {viewingResponse.user?.name || "Tablet"}
                </p>
              </div>
              <button type="button" onClick={() => setViewingResponse(null)} className="grid size-11 place-items-center rounded-full bg-black/[0.04] text-black/60 hover:bg-black/[0.08] transition"><X className="size-5" /></button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-6 flex-1">
              {/* Cliente Info Section */}
              <div className="bg-[#FAF6F9]/50 rounded-2xl p-4 border border-black/[0.03] space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Informazioni Cliente</p>
                <div className="grid gap-3 sm:grid-cols-3 text-sm font-semibold">
                  <div>
                    <span className="text-black/40 block text-xs">Email</span>
                    <span className="text-black/85">{answerText(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.email]) || "Non inserita"}</span>
                  </div>
                  <div>
                    <span className="text-black/40 block text-xs">Telefono</span>
                    <span className="text-black/85">{answerText(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.phone]) || "Non inserito"}</span>
                  </div>
                  <div>
                    <span className="text-black/40 block text-xs">Tag Instagram</span>
                    <span className="text-[#D96B94] font-bold">
                      {viewingResponse.answers?.custom_ig_tag || viewingResponse.answers?.igTag ? `@${String(viewingResponse.answers.custom_ig_tag || viewingResponse.answers.igTag).replace(/^@/, "")}` : "Non inserito"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Items Section */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Prodotti / Servizi Acquistati</p>
                {viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.productsList] ? (
                  <div className="grid gap-2">
                    {String(viewingResponse.answers[CLIENT_CONTROL_FIELD_IDS.productsList])
                      .split(",")
                      .map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4 text-emerald-900 font-bold text-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span>{item.trim()}</span>
                        </div>
                      ))
                    }
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm font-bold text-black/40">
                    Nessun prodotto o servizio registrato per questo controllo.
                  </div>
                )}
              </div>

              {/* Details grid: Pagamento & Staff */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Pagamento */}
                <div className="bg-[#FAF6F9]/30 rounded-2xl p-4 border border-black/[0.03] space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Dettagli Pagamento</p>
                  <div className="space-y-1.5 text-sm font-bold">
                    <div className="flex justify-between">
                      <span className="text-black/40 font-semibold text-xs">Acconto Pagato</span>
                      <span className="text-black/80">{money(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.depositPaid])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/40 font-semibold text-xs">Saldo Pagato</span>
                      <span className="text-black/80">{money(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paid])}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-black/5 pt-2">
                      <span className="text-black/40 font-semibold text-xs">Metodo verificato</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paymentVerified] === true
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {String(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paymentMethod] || "Da verificare") === "CASHMATIC"
                          ? "Cashmatic"
                          : String(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paymentMethod] || "Da verificare") === "CARTA"
                            ? "Carta"
                            : "Da verificare"}
                      </span>
                    </div>
                    {viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paymentReference] ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-black/40 font-semibold text-xs">ID pagamento</span>
                        <span className="max-w-[180px] truncate text-right text-xs font-bold text-black/65">
                          {String(viewingResponse.answers[CLIENT_CONTROL_FIELD_IDS.paymentReference])}
                        </span>
                      </div>
                    ) : null}
                    {viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] ? (
                      <div className="flex justify-between pt-1 border-t border-black/5">
                        <span className="text-black/40 font-semibold text-xs">1° Ordine Shopify (Acconto)</span>
                        <span className="text-black/70">#{viewingResponse.answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder]}</span>
                      </div>
                    ) : null}
                    {(viewingResponse.answers?.second_shopify_order || viewingResponse.answers?.secondShopifyOrder) ? (
                      <div className="flex justify-between">
                        <span className="text-black/40 font-semibold text-xs">2° Ordine Shopify (Saldo)</span>
                        <span className="text-[#D96B94] font-black">#{viewingResponse.answers.second_shopify_order || viewingResponse.answers.secondShopifyOrder}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Staff / Sede */}
                <div className="bg-[#FAF6F9]/30 rounded-2xl p-4 border border-black/[0.03] space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Sede e Collaboratori</p>
                  <div className="space-y-1.5 text-sm font-bold">
                    <div className="flex justify-between">
                      <span className="text-black/40 font-semibold text-xs">Sede</span>
                      <span className="text-black/80">{answerText(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.location] || viewingResponse.user_location_name)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-black/40 font-semibold text-xs">Staff Collaboratrici</span>
                      <div className="flex items-center gap-2">
                        {viewingResponse.user?.photo_url ? (
                          <img
                            src={viewingResponse.user.photo_url}
                            alt="Foto Staff"
                            className="size-7 rounded-full object-cover border border-[#D96B94] shadow-2xs"
                          />
                        ) : (
                          <div className="grid size-7 place-items-center rounded-full bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white text-[11px] font-black uppercase shadow-2xs">
                            {(String(namesFromAnswer(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.serviceStaff] || viewingResponse.user?.name || "S")[0] || "S"))[0]}
                          </div>
                        )}
                        <span className="text-black/80 font-bold line-clamp-1">
                          {answerText(
                            namesFromAnswer(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.serviceStaff] || viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.serviceOwner] || viewingResponse.user?.name)
                              .map((name) => resolveCanonicalStaffName(name, employeeNames))
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DETTAGLI EXTENSION & APPOINTMENT */}
              <div className="bg-[#FFF8FB] rounded-2xl p-4 border border-[#F9D5E7] space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B83D7F]">Dettagli Extension & Appuntamento</p>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-black/5">
                    <span className="text-black/40 block font-semibold text-[10px] uppercase">Grammi</span>
                    <span className="font-black text-[#1F1F1F] text-sm">
                      {viewingResponse.answers?.custom_grammi || viewingResponse.answers?.customGrammi || "N/D"}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-black/5">
                    <span className="text-black/40 block font-semibold text-[10px] uppercase">Lunghezza</span>
                    <span className="font-black text-[#1F1F1F] text-sm">
                      {viewingResponse.answers?.custom_lunghezza || viewingResponse.answers?.customLunghezza || "N/D"}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-black/5">
                    <span className="text-black/40 block font-semibold text-[10px] uppercase">Fasce</span>
                    <span className="font-black text-[#1F1F1F] text-sm">
                      {viewingResponse.answers?.custom_fasce || viewingResponse.answers?.customFasce || "N/D"}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-black/5">
                    <span className="text-black/40 block font-semibold text-[10px] uppercase">Atteggiamento</span>
                    <span className="font-black text-[#1F1F1F] text-sm">
                      {viewingResponse.answers?.custom_atteggiamento || viewingResponse.answers?.customAtteggiamento || "N/D"}
                    </span>
                  </div>
                </div>
                {(viewingResponse.answers?.custom_extra_note || viewingResponse.answers?.customExtraNote) ? (
                  <div className="bg-white p-3 rounded-xl border border-black/5">
                    <span className="text-black/40 block font-semibold text-[10px] uppercase mb-0.5">Note Extra</span>
                    <p className="text-xs font-semibold text-black/80 italic">
                      "{viewingResponse.answers.custom_extra_note || viewingResponse.answers.customExtraNote}"
                    </p>
                  </div>
                ) : null}
              </div>

              {/* VERIFICHE E CONTROLLI BADGES */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-black/5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Verifiche e Controlli Effettuati</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    [CLIENT_CONTROL_FIELD_IDS.notes, "Note Shopify"],
                    [CLIENT_CONTROL_FIELD_IDS.beforeMedia, "Prima foto/video"],
                    [CLIENT_CONTROL_FIELD_IDS.afterMedia, "Dopo foto/video"],
                    [CLIENT_CONTROL_FIELD_IDS.products, "Prodotti"],
                    [CLIENT_CONTROL_FIELD_IDS.review, "Recensione"],
                  ].map(([fieldKey, fieldLabel]) => {
                    const isChecked = truthy(viewingResponse.answers?.[fieldKey]);
                    return (
                      <span
                        key={fieldKey}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black border",
                          isChecked
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-neutral-100 text-black/40 border-black/5 opacity-60"
                        )}
                      >
                        <Check className={cn("size-3.5", isChecked ? "text-emerald-600" : "text-black/30")} strokeWidth={3} />
                        <span>{fieldLabel}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Comparison Section (Shopify Expected vs Declared) */}
              <div className="bg-[#FAF6F9]/50 rounded-2xl p-5 border border-black/[0.03] space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40 font-bold">Confronto Pagamento (Shopify vs Dichiarato)</p>
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  {/* Dichiarato da Staff */}
                  <div className="bg-white rounded-2xl p-4 border border-black/5 space-y-2 shadow-2xs">
                    <span className="text-black/40 block text-xs font-bold uppercase tracking-wider">Dichiarato da Staff</span>
                    <div className="space-y-1.5 text-xs font-semibold">
                      <div className="flex justify-between">
                        <span className="text-black/50">1° Acconto Pagato:</span>
                        <span className="font-bold text-black/80">{money(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.depositPaid])}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black/50">2° Saldo Pagato:</span>
                        <span className="font-bold text-black/80">{money(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paid])}</span>
                      </div>
                      <div className="flex justify-between border-t border-black/5 pt-1.5 mt-1">
                        <span className="font-black text-black">Totale Dichiarato:</span>
                        <span className="text-base font-black text-[#1F1F1F]">
                          {money(parseFloat(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.depositPaid] || "0") + parseFloat(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paid] || "0"))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Atteso su Shopify */}
                  <div className="bg-white rounded-2xl p-4 border border-black/5 space-y-2 shadow-2xs">
                    <span className="text-black/40 block text-xs font-bold uppercase tracking-wider">Atteso su Shopify</span>
                    <div className="space-y-1.5 text-xs font-semibold">
                      <div className="flex justify-between">
                        <span className="text-black/50">1° Acconto (Atteso):</span>
                        <span className="font-bold text-emerald-700">
                          {money(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.depositPaid] || viewingResponse.answers?.client_control_shopify_expected_paid || "0")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black/50">2° Saldo (Atteso):</span>
                        <span className="font-bold text-emerald-700">
                          {money(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paid])}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-black/5 pt-1.5 mt-1">
                        <span className="font-black text-black">Totale Atteso Shopify:</span>
                        <span className="text-base font-black text-emerald-600">
                          {money(parseFloat(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.depositPaid] || "0") + parseFloat(viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.paid] || "0"))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shopify Order Note Section */}
              {viewingResponse.answers?.client_control_shopify_order_note ? (
                <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100/60 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-800 font-bold">Nota Ordine Shopify</p>
                  <p className="text-sm font-semibold text-black/70 italic">
                    "{viewingResponse.answers.client_control_shopify_order_note}"
                  </p>
                </div>
              ) : null}

              {/* Notes Section */}
              {viewingResponse.answers?.client_control_notes_text || viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.notes] ? (
                <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100/60 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">Note Interne</p>
                  <p className="text-sm font-semibold text-black/70 italic">
                    "{answerText(viewingResponse.answers.client_control_notes_text || "Nota spuntata")}"
                  </p>
                </div>
              ) : null}

              {/* Sezione Foto (Google Drive o Supabase) */}
              {viewingResponse.answers?.photo_prima_fronte ||
              viewingResponse.answers?.photo_prima_dietro ||
              viewingResponse.answers?.photo_dopo_fronte ||
              viewingResponse.answers?.photo_dopo_dietro ? (
                <div className="bg-[#FAF7F9] rounded-2xl p-5 border border-black/5 space-y-3 col-span-full">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C66170] font-bold">Foto Servizio Cliente (Google Drive)</p>
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                    {[
                      { key: "photo_prima_fronte", label: "Prima Fronte" },
                      { key: "photo_prima_dietro", label: "Prima Dietro" },
                      { key: "photo_dopo_fronte", label: "Dopo Fronte" },
                      { key: "photo_dopo_dietro", label: "Dopo Dietro" },
                    ].map((slot) => {
                      const photo = viewingResponse.answers?.[slot.key];
                      if (!photo) return null;
                      const srcUrl = photo.driveFileUrl || (photo.storagePath ? `/api/service-forms/responses/file?path=${encodeURIComponent(photo.storagePath)}` : "");
                      
                      return (
                        <div key={slot.key} className="flex flex-col items-center bg-white p-3 rounded-xl border border-black/5 space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-black/40">{slot.label}</span>
                          <div className="relative rounded-lg overflow-hidden border border-black/10 bg-black/5 w-full aspect-square flex items-center justify-center">
                            <img
                              src={srcUrl}
                              alt={slot.label}
                              className="object-cover size-full"
                            />
                          </div>
                          <a
                            href={srcUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-black/5 bg-[#FAF7F9] px-2 py-1 text-[10px] font-semibold text-[#C66170] shadow-sm hover:bg-[#C66170]/5 transition w-full justify-center"
                          >
                            Apri Originale
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : viewingResponse.answers?.[CLIENT_CONTROL_FIELD_IDS.clientPhoto] ? (
                <div className="bg-[#FAF7F9] rounded-2xl p-4 border border-black/5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C66170] font-bold">Foto Volto Cliente</p>
                  <div className="relative rounded-2xl overflow-hidden border border-black/10 bg-black/5 max-w-sm aspect-video flex items-center justify-center">
                    <img
                      src={viewingResponse.answers[CLIENT_CONTROL_FIELD_IDS.clientPhoto].driveFileUrl || `/api/service-forms/responses/file?path=${encodeURIComponent(viewingResponse.answers[CLIENT_CONTROL_FIELD_IDS.clientPhoto].storagePath || "")}`}
                      alt="Foto Volto Cliente"
                      className="object-contain max-h-48 w-full"
                    />
                  </div>
                  <a
                    href={viewingResponse.answers[CLIENT_CONTROL_FIELD_IDS.clientPhoto].driveFileUrl || `/api/service-forms/responses/file?path=${encodeURIComponent(viewingResponse.answers[CLIENT_CONTROL_FIELD_IDS.clientPhoto].storagePath || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[#C66170] shadow-sm hover:bg-[#C66170]/5 transition mt-1"
                  >
                    Visualizza / Scarica Foto
                  </a>
                </div>
              ) : null}
            </div>
            
            <div className="border-t border-black/10 p-5 flex justify-end bg-[#FAF6F9]">
              <button type="button" onClick={() => setViewingResponse(null)} className="rounded-2xl bg-black/[0.04] hover:bg-black/[0.08] text-black/70 px-6 py-3 text-sm font-black transition">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
