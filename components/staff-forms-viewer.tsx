"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ClipboardList, AlertCircle, CheckCircle2, ChevronRight, X, Loader2, Upload, Calendar, MapPin, User, Clock, Download, Plus, MessageSquare, Eye, Archive, ArrowUpRight, ShoppingCart, Check, Pencil, CreditCard, Calculator, Search, ReceiptText, ClipboardCheck, UserPlus, ShoppingBag, FileText, History, Receipt, RotateCcw, PackageCheck } from "lucide-react";
import { Badge, Card, Button } from "@/components/ui";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ResponseComments } from "@/components/response-comments";
import { cn } from "@/lib/utils";

const CLIENT_CONTROL_FIELD_IDS = {
  serviceOwner: "client_control_service_owner",
  serviceStaff: "client_control_service_staff",
  correctness: "client_control_correctness",
} as const;

type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "file" | "money" | "date" | "worker" | "worker_multi" | "checkbox" | "pin";
  required: boolean;
  options?: string[];
  description?: string;
  show_if?: {
    field_id: string;
    operator: "equals" | "not_equals" | "contains";
    value: string;
  } | null;
  show_ifs?: {
    field_id: string;
    operator: "equals" | "not_equals" | "contains";
    value: string;
  }[];
  position?: { x: number; y: number };
};

type FormTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  active: boolean;
  fields: FormField[];
};

type PickupReadyOrder = {
  id: string;
  orderNumber: string;
  clientName: string;
  phone?: string;
  salon?: string;
  createdBy?: string;
  createdAt?: string;
  summary?: string;
  notes?: string;
  updatedAt?: string;
  status?: string;
  statusLabel?: string;
  statusAudit?: {
    changedAt?: string;
    changedBy?: string;
    text?: string;
  };
  pickup?: {
    pickupName?: string;
    completedByName?: string;
    completedAt?: string;
    proof?: { driveFileUrl?: string; webViewLink?: string; webContentLink?: string; name?: string };
  } | null;
  payment?: {
    total: number | null;
    paid: number;
    deposit: number;
    missing: number | null;
  };
  attachments?: Array<{
    label: string;
    name: string;
    url: string;
    type?: string;
    isImage?: boolean;
    previewable?: boolean;
  }>;
  answers?: Record<string, any>;
  fields?: Array<{ id: string; label: string; type?: string }>;
};

type PickupStatusNotice = {
  found: boolean;
  ready?: boolean;
  status?: string;
  statusLabel?: string;
  order?: PickupReadyOrder | null;
};

function formatEuro(value: number | null | undefined) {
  if (value === null || value === undefined) return "Non indicato";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

function formatPickupDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPickupAnswer(value: any) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    if (value.url || value.driveFileUrl || value.webViewLink) return String(value.name || value.url || value.driveFileUrl || value.webViewLink);
    return "";
  }
  return String(value);
}

function pickupOrderDetails(order: PickupReadyOrder) {
  const answers = order.answers ?? {};
  const fields = order.fields ?? [];
  const seen = new Set<string>();
  const details: Array<{ label: string; value: string }> = [];
  if (order.notes) {
    details.push({ label: "Note ordine", value: order.notes });
  }
  if (order.summary) {
    details.push({ label: "Dettaglio lavoro", value: order.summary });
  }

  details.push(
    ...fields
    .map((field) => {
      const value = formatPickupAnswer(answers[field.id]);
      if (!value || field.id.startsWith("__")) return null;
      seen.add(field.id);
      return { label: field.label, value };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>
  );

  Object.entries(answers).forEach(([key, rawValue]) => {
    if (seen.has(key) || key.startsWith("__")) return;
    const value = formatPickupAnswer(rawValue);
    if (!value) return;
    const label = key
      .replace(/^client_control_/, "")
      .replace(/^order_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    details.push({ label, value });
  });

  return details;
}

function pickupProofUrl(order: PickupReadyOrder) {
  return order.pickup?.proof?.driveFileUrl || order.pickup?.proof?.webViewLink || order.pickup?.proof?.webContentLink || "";
}

function isOrderLabelForm(form?: { name?: string | null; category?: string | null } | null) {
  const name = String(form?.name || "").toLowerCase();
  const category = String(form?.category || "").toLowerCase();
  return name.includes("modulo ordine") || category.includes("ordini");
}

export function StaffFormsViewer({
  forms,
  employees = [],
  initialResponses = [],
  currentUserId,
  currentUserName,
  currentUserRole,
  autoFillFormId,
  autoFillFormName,
  pastCustomers = [],
}: {
  forms: FormTemplate[];
  employees?: Array<{ id: string; name: string; locationId?: string | null; locationName?: string | null; isPresent?: boolean }>;
  initialResponses?: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  autoFillFormId?: string;
  autoFillFormName?: string;
  pastCustomers?: Array<{
    name: string;
    type: string;
    fiscalCode: string;
    vatNumber: string;
    sdiCode: string;
    pec: string;
    address: string;
  }>;
}) {
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
  const [selectedFormForHistory, setSelectedFormForHistory] = useState<FormTemplate | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);
  const [responses, setResponses] = useState<any[]>(initialResponses);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [customSelectValue, setCustomSelectValue] = useState<string>("");
  const [showPastCustomers, setShowPastCustomers] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupQuery, setPickupQuery] = useState("");
  const [pickupName, setPickupName] = useState("");
  const [pickupPin, setPickupPin] = useState("");
  const [pickupPaidConfirmed, setPickupPaidConfirmed] = useState(false);
  const [pickupProof, setPickupProof] = useState<File | null>(null);
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [pickupMessage, setPickupMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pickupReadyOrders, setPickupReadyOrders] = useState<PickupReadyOrder[]>([]);
  const [pickupLoadingOrders, setPickupLoadingOrders] = useState(false);
  const [pickupSelectedOrder, setPickupSelectedOrder] = useState<PickupReadyOrder | null>(null);
  const [pickupStatusNotice, setPickupStatusNotice] = useState<PickupStatusNotice | null>(null);

  const handleSelectCustomer = (cust: any) => {
    setAnswers((prev) => ({
      ...prev,
      invoice_client_type: cust.type,
      invoice_client_name: cust.name,
      invoice_fiscal_code: cust.fiscalCode,
      invoice_vat_number: cust.vatNumber,
      invoice_sdi_code: cust.sdiCode,
      invoice_pec: cust.pec,
      invoice_address: cust.address,
    }));
    setShowPastCustomers(false);
    setCustomerSearchQuery("");
  };

  const handleSaveAnswer = async (fieldId: string, newValue: string) => {
    if (!selectedResponse) return;
    try {
      const updatedAnswers = {
        ...selectedResponse.answers,
        [fieldId]: newValue,
      };
      const res = await fetch(`/api/service-forms/responses/${selectedResponse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: updatedAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedResponse(data);
        setResponses((prev) =>
          prev.map((item) => (item.id === data.id ? data : item))
        );
        setEditingFieldId(null);
      } else {
        alert("Errore durante il salvataggio.");
      }
    } catch (err) {
      console.error(err);
      alert("Si è verificato un errore, riprova.");
    }
  };
  const [expandedFormId, setExpandedFormId] = useState<string | null>(forms[0]?.id ?? null);

  const loadPickupReadyOrders = React.useCallback(async () => {
    setPickupLoadingOrders(true);
    try {
      const response = await fetch("/api/orders/pickup", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Errore caricamento ordini pronti.");
      setPickupReadyOrders(Array.isArray(result.items) ? result.items : []);
    } catch (error) {
      setPickupMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Errore caricamento ordini pronti.",
      });
    } finally {
      setPickupLoadingOrders(false);
    }
  }, []);

  React.useEffect(() => {
    if (showPickupModal) {
      void loadPickupReadyOrders();
    }
  }, [showPickupModal, loadPickupReadyOrders]);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleCardClick = (form: FormTemplate) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      handleOpenForm(form);
    } else {
      timerRef.current = setTimeout(() => {
        setSelectedFormForHistory(form);
        timerRef.current = null;
      }, 250);
    }
  };

  const formSubmissions = useMemo(() => {
    if (!selectedFormForHistory) return [];
    return responses.filter((r) => r.form_id === selectedFormForHistory.id);
  }, [responses, selectedFormForHistory]);

  const filteredPickupReadyOrders = useMemo(() => {
    const query = pickupQuery.trim().toLowerCase();
    if (!query) return pickupReadyOrders;
    return pickupReadyOrders.filter((order) =>
      [
        order.orderNumber,
        order.clientName,
        order.phone,
        order.salon,
        order.summary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [pickupQuery, pickupReadyOrders]);

  React.useEffect(() => {
    if (!showPickupModal) return;
    const query = pickupQuery.trim();
    setPickupStatusNotice(null);
    if (query.length < 3) return;
    if (pickupReadyOrders.some((order) => (order.orderNumber || order.clientName).toLowerCase() === query.toLowerCase())) return;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/orders/pickup?query=${encodeURIComponent(query)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) return;
        setPickupStatusNotice(result);
        if (result.order) {
          setPickupSelectedOrder(result.order);
        }
      } catch {
        setPickupStatusNotice(null);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [pickupQuery, pickupReadyOrders, showPickupModal]);
  
  // Input answer states (mapped by field ID)
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);

  const [loadingVat, setLoadingVat] = useState(false);
  const [vatLookupStatus, setVatLookupStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [loadingShopify, setLoadingShopify] = useState(false);
  const [shopifyLookupStatus, setShopifyLookupStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleVatLookup = async () => {
    const vat = String(answers["invoice_vat_number"] || "").replace(/\D/g, "");
    if (!vat || vat.length !== 11) {
      setVatLookupStatus({ success: false, message: "La Partita IVA deve essere di 11 cifre." });
      return;
    }

    setLoadingVat(true);
    setVatLookupStatus(null);

    try {
      const res = await fetch(`/api/vat-lookup?vat=${vat}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore di ricerca.");
      }

      setAnswers(prev => ({
        ...prev,
        "invoice_client_name": data.name,
        "invoice_address": data.address,
      }));

      setVatLookupStatus({
        success: true,
        message: `✓ AZIENDA TROVATA\n• Ragione Sociale: ${data.name}\n• Indirizzo: ${data.address}`
      });
    } catch (err: any) {
      setVatLookupStatus({
        success: false,
        message: err.message || "Errore nella ricerca della Partita IVA."
      });
    } finally {
      setLoadingVat(false);
    }
  };

  const handleShopifyOrderLookup = async () => {
    const query = String(answers["invoice_shopify_order"] || "").trim();
    
    setLoadingShopify(true);
    setShopifyLookupStatus(null);

    try {
      const res = await fetch(`/api/shopify-order-lookup?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore di caricamento.");
      }

      setAnswers(prev => {
        const nextAnswers = { ...prev };
        if (data.clientName) nextAnswers["invoice_client_name"] = data.clientName;
        if (data.totalPrice !== null && data.totalPrice !== undefined) nextAnswers["invoice_amount"] = String(data.totalPrice);
        if (data.orderName) nextAnswers["invoice_receipt_ref"] = data.orderName;
        if (data.lineItems) nextAnswers["invoice_shopify_items"] = data.lineItems;
        
        const titles = Array.isArray(data.lineItems) ? data.lineItems.map((it: any) => it.title) : [];
        let productsNote = `Importato da ordine Shopify ${data.orderName || ""}`;
        if (titles.length > 0) {
          productsNote += `\nProdotti: ${titles.join(", ")}`;
        }
        nextAnswers["invoice_notes"] = productsNote;

        return nextAnswers;
      });

      const titles = Array.isArray(data.lineItems) ? data.lineItems.map((it: any) => it.title) : [];
      const prodList = titles.length > 0 
        ? titles.join(", ") 
        : "Nessuno";
      setShopifyLookupStatus({
        success: true,
        message: `✓ ORDINE TROVATO (${data.orderName || ""})\n• Cliente: ${data.clientName || "N/A"}\n• Totale: € ${data.totalPrice !== null ? data.totalPrice.toFixed(2) : "0.00"}\n• Prodotti: ${prodList}`
      });
    } catch (err: any) {
      setShopifyLookupStatus({
        success: false,
        message: err.message || "Errore nel caricamento dell'ordine Shopify."
      });
    } finally {
      setLoadingShopify(false);
    }
  };

  // Derived helper variables for dynamic group participants form
  const visibleForms = forms.filter((form) => {
    const name = form.name.toUpperCase().trim();
    const category = form.category.toUpperCase().trim();
    return name !== "FOTO ORDINI" && !(category === "FOTO" && name.includes("FOTO"));
  });
  const candidaturaForm = visibleForms.find(f => f.name.toUpperCase().includes("CANDIDATURA"));
  const orderForm = visibleForms.find(f => {
    const name = f.name.toUpperCase();
    const category = f.category.toUpperCase();
    return (category.includes("ORDIN") || name.includes("ORDINE")) && !name.includes("FOTO");
  });
  const cashClosingForm = visibleForms.find(f => f.name.toUpperCase().includes("CHIUSURA CASSA") || f.category.toUpperCase().includes("CASSA"));
  const italianInvoiceForm = visibleForms.find(f => f.name.toUpperCase().includes("FATTURA") || f.category.toUpperCase().includes("FATTUR"));
  const clientControlForm = visibleForms.find(f => f.name.toUpperCase().includes("CONTROLLO CLIENTE") || f.category.toUpperCase().includes("QUALITA"));
  const refundForm = visibleForms.find(f => f.name.toUpperCase().includes("RIMBORSO") || f.category.toUpperCase().includes("AMMINIST"));
  const primaryFormIds = new Set([orderForm?.id, candidaturaForm?.id, cashClosingForm?.id, italianInvoiceForm?.id, clientControlForm?.id, refundForm?.id].filter(Boolean));
  const regularForms = visibleForms.filter((form) => !primaryFormIds.has(form.id));
  const participaField = selectedForm?.fields.find(f => f.label.toUpperCase().includes("PARTICIPA"));
  const participaValue = participaField ? answers[participaField.id] : "";
  const isGroupCourse = String(participaValue || "").toUpperCase().includes("GRUP");
  const isCorsistiForm = selectedForm?.name.toUpperCase().includes("CORSISTI");
  const groupCount = parseInt(answers["group_participants_count"] || "2", 10);
  const isCashClosingForm = selectedForm
    ? selectedForm.name.toUpperCase().includes("CHIUSURA CASSA") || selectedForm.category.toUpperCase().includes("CASSA")
    : false;
  const isSelectedClientControlForm = selectedForm
    ? selectedForm.name.toUpperCase().includes("CONTROLLO CLIENTE") || selectedForm.category.toUpperCase().includes("QUALITA")
    : false;
  const autoClientControlFieldIds = new Set<string>([
    CLIENT_CONTROL_FIELD_IDS.serviceOwner,
    CLIENT_CONTROL_FIELD_IDS.serviceStaff,
  ]);

  const isDefaultParticipantField = (fieldLabel: string) => {
    const labelUpper = fieldLabel.toUpperCase();
    return labelUpper === "NOME CORSISTA" || labelUpper === "EMAIL CORSISTA" || labelUpper === "NUMERO CORSISTA";
  };

  const isFieldVisible = (field: FormField, sourceAnswers = answers) => {
    const conditions = field.show_ifs && field.show_ifs.length > 0
      ? field.show_ifs
      : field.show_if?.field_id
        ? [field.show_if]
        : [];

    if (conditions.length === 0) return true;

    return conditions.some(cond => {
      if (!cond.field_id) return true;
      const actualValue = String(sourceAnswers[cond.field_id] ?? "").toLowerCase().trim();
      const expectedValue = String(cond.value ?? "").toLowerCase().trim();
      if (!expectedValue) return Boolean(actualValue);
      if (cond.operator === "contains") return actualValue.includes(expectedValue);
      if (cond.operator === "not_equals") return actualValue !== expectedValue;
      return actualValue === expectedValue;
    });
  };

  const visibleFields = useMemo(() => {
    if (!selectedForm) return [];
    return selectedForm.fields.filter((field) => {
      const isVisible = isFieldVisible(field);
      if (!isVisible) return false;
      if (isSelectedClientControlForm && autoClientControlFieldIds.has(field.id)) {
        return false;
      }
      if (isCorsistiForm && isGroupCourse && isDefaultParticipantField(field.label)) {
        return false;
      }
      return true;
    });
  }, [selectedForm, answers, isCorsistiForm, isGroupCourse]);

  const currentActiveIndex = Math.min(activeFieldIndex, Math.max(0, visibleFields.length - 1));
  const progressPercentage = visibleFields.length > 0
    ? Math.round(((currentActiveIndex + 1) / visibleFields.length) * 100)
    : 0;
  const answeredVisibleCount = visibleFields.filter((field) => {
    if (field.type === "file") return Boolean(files[field.id]);
    if (field.type === "checkbox") return answers[field.id] === true;
    if (field.type === "worker_multi") return Array.isArray(answers[field.id]) && answers[field.id].length > 0;
    const value = answers[field.id];
    return value !== undefined && value !== null && String(value).trim() !== "";
  }).length;

  const isCurrentFieldValid = (field: FormField) => {
    if (!field.required) return true;

    // Special case: group course participants details validation
    if (field.id === participaField?.id && isGroupCourse) {
      const count = parseInt(answers["group_participants_count"] || "2", 10);
      for (let i = 1; i <= count; i++) {
        const name = answers[`participant_${i}_name`]?.trim();
        if (!name) return false;
      }
    }

    if (field.type === "file") {
      return !!files[field.id];
    }

    if (field.type === "checkbox") {
      return answers[field.id] === true;
    }

    if (field.type === "worker_multi") {
      return Array.isArray(answers[field.id]) && answers[field.id].length > 0;
    }

    const val = answers[field.id];
    if (val === undefined || val === null || String(val).trim() === "") {
      return false;
    }

    if (val === "Altro") {
      const altroVal = answers[field.id + "_altro"];
      if (altroVal === undefined || altroVal === null || String(altroVal).trim() === "") {
        return false;
      }
    }

    return true;
  };

  const handleNextOrSubmit = () => {
    const currentField = visibleFields[currentActiveIndex];
    if (!currentField) return;

    if (!isCurrentFieldValid(currentField)) {
      setErrorMsg("Per favore, compila questo campo obbligatorio prima di procedere.");
      return;
    }

    setErrorMsg("");

    if (currentActiveIndex < visibleFields.length - 1) {
      setActiveFieldIndex(currentActiveIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, fieldType: string) => {
    if (e.key === "Enter" && fieldType !== "textarea") {
      e.preventDefault();
      handleNextOrSubmit();
    }
  };

  const responseParticipaField = selectedResponse?.form?.fields 
    ? (selectedResponse.form.fields as any[]).find(f => f.label.toUpperCase().includes("PARTICIPA")) 
    : null;
  const responseParticipaValue = responseParticipaField && selectedResponse?.answers 
    ? selectedResponse.answers[responseParticipaField.id] 
    : "";
  const isResponseGroupCourse = String(responseParticipaValue || "").toUpperCase().includes("GRUP");
  const isResponseCorsistiForm = selectedResponse?.form?.name?.toUpperCase().includes("CORSISTI");
  const responseGroupCount = (() => {
    let count = parseInt(selectedResponse?.answers?.["group_participants_count"] || "0", 10);
    if (isResponseGroupCourse && count === 0 && selectedResponse?.answers) {
      let maxIdx = 0;
      for (let i = 1; i <= 10; i++) {
        if (selectedResponse.answers[`participant_${i}_name`]) {
          maxIdx = i;
        }
      }
      count = maxIdx > 0 ? maxIdx : 2;
    }
    return count;
  })();


  // Extract upcoming events from active responses containing date fields
  const upcomingEvents = useMemo(() => {
    const events: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    responses.forEach((resp) => {
      if (resp.status === "ARCHIVED") return;

      const fields = resp.form?.fields as FormField[] | null;
      const answersObj = resp.answers as Record<string, any> | null;
      if (!fields || !answersObj) return;

      fields.forEach((field) => {
        if (field.type === "date") {
          const dateVal = answersObj[field.id];
          if (dateVal && typeof dateVal === "string") {
            const eventDate = new Date(dateVal);
            if (!isNaN(eventDate.getTime())) {
              const eventDay = new Date(eventDate);
              eventDay.setHours(0, 0, 0, 0);
              
              if (eventDay >= today) {
                events.push({
                  responseId: resp.id,
                  response: resp,
                  formName: resp.form.name,
                  userName: resp.user?.name || "Dipendente",
                  locationName: resp.user_location_name,
                  dateValue: dateVal,
                  dateLabel: new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(eventDate),
                  daysLeft: Math.ceil((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
                  answers: answersObj,
                  fields
                });
              }
            }
          }
        }
      });
    });

    // Sort chronologically
    return events.sort((a, b) => a.dateValue.localeCompare(b.dateValue));
  }, [responses]);
  
  // Submission UI States
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleArchiveResponse = async (responseId: string) => {
    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (res.ok) {
        setResponses((prev) => 
          prev.map((r) => r.id === responseId ? { ...r, status: "ARCHIVED" } : r)
        );
        if (selectedResponse && selectedResponse.id === responseId) {
          setSelectedResponse({ ...selectedResponse, status: "ARCHIVED" });
        }
      } else {
        alert("Errore durante il completamento del modulo.");
      }
    } catch (err) {
      console.error("Failed to archive response:", err);
      alert("Si è verificato un errore, riprova.");
    }
  };

  const handlePickupSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pickupSubmitting) return;

    if (pickupSelectedOrder && pickupSelectedOrder.status !== "READY") {
      setPickupMessage({
        type: "error",
        text: `Questo ordine e in stato ${pickupSelectedOrder.statusLabel || pickupSelectedOrder.status}. Puoi consultarlo, ma non completare il ritiro.`,
      });
      return;
    }

    if (!pickupQuery.trim() || !pickupName.trim() || !pickupPin.trim() || !pickupPaidConfirmed) {
      setPickupMessage({
        type: "error",
        text: "Compila ordine, nome ritiro, PIN firma e conferma saldo.",
      });
      return;
    }

    setPickupSubmitting(true);
    setPickupMessage(null);

    try {
      const formData = new FormData();
      formData.append("query", pickupQuery.trim());
      formData.append("pickupName", pickupName.trim());
      formData.append("pickupPin", pickupPin.trim());
      formData.append("paidConfirmed", pickupPaidConfirmed ? "true" : "false");
      if (pickupProof) {
        formData.append("proof", pickupProof);
      }

      const response = await fetch("/api/orders/pickup", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossibile completare il ritiro.");
      }

      if (result.order) {
        setResponses((prev) => prev.map((item) => (item.id === result.order.id ? result.order : item)));
        setPickupReadyOrders((prev) => prev.filter((item) => item.id !== result.order.id));
      }

      setPickupMessage({ type: "success", text: result.message || "Ritiro completato. Ordine spostato in Completato." });
      setPickupQuery("");
      setPickupName("");
      setPickupPin("");
      setPickupPaidConfirmed(false);
      setPickupProof(null);
      setPickupSelectedOrder(null);
    } catch (error) {
      setPickupMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Impossibile completare il ritiro.",
      });
    } finally {
      setPickupSubmitting(false);
    }
  };

  const handleOpenForm = (form: FormTemplate) => {
    const isCashClosing = form.name.toUpperCase().includes("CHIUSURA CASSA") || form.category.toUpperCase().includes("CASSA");
    const isClientControl = form.name.toUpperCase().includes("CONTROLLO CLIENTE") || form.category.toUpperCase().includes("QUALITA");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    setSelectedForm(form);
    setAnswers(
      isCashClosing
        ? { cash_date: today, cash_fund: "50.00" }
        : isClientControl
          ? {
              [CLIENT_CONTROL_FIELD_IDS.correctness]: "Da controllare",
              [CLIENT_CONTROL_FIELD_IDS.serviceOwner]: currentUserName,
              [CLIENT_CONTROL_FIELD_IDS.serviceStaff]: [currentUserName],
            }
          : {}
    );
    setFiles({});
    setSuccess(false);
    setErrorMsg("");
    setActiveFieldIndex(0);
    setShowPastCustomers(false);
    setCustomerSearchQuery("");
  };

  React.useEffect(() => {
    if (autoFillFormId) {
      const match = forms.find(f => f.id === autoFillFormId);
      if (match) {
        handleOpenForm(match);
      }
    } else if (autoFillFormName) {
      const match = forms.find(f => f.name.toUpperCase().includes(autoFillFormName.toUpperCase()));
      if (match) {
        handleOpenForm(match);
      }
    }
  }, [autoFillFormId, autoFillFormName, forms]);

  const handleTextChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileChange = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [fieldId]: file }));
    }
  };

  const handleSelectChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrorMsg("");

    if (value && value !== "Altro") {
      setTimeout(() => {
        setActiveFieldIndex((prevIndex) => {
          if (prevIndex < visibleFields.length - 1) {
            return prevIndex + 1;
          }
          return prevIndex;
        });
      }, 350);
    }
  };

  const toggleWorkerMulti = (fieldId: string, workerName: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] as string[] : [];
      const next = current.includes(workerName)
        ? current.filter((name) => name !== workerName)
        : [...current, workerName];
      return { ...prev, [fieldId]: next };
    });
    setErrorMsg("");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedForm || submitting) return;

    // Double check all fields validity
    const invalidField = visibleFields.find((f) => !isCurrentFieldValid(f));
    if (invalidField) {
      setErrorMsg(`Il campo "${invalidField.label}" è obbligatorio.`);
      const idx = visibleFields.indexOf(invalidField);
      if (idx !== -1) {
        setActiveFieldIndex(idx);
      }
      return;
    }

    if (isCashClosingForm) {
      const fundValue = Number(String(answers.cash_fund ?? "").replace(",", "."));
      const notesValue = String(answers.cash_notes ?? "").trim();
      if (Number.isFinite(fundValue) && Math.abs(fundValue - 50) > 0.009 && !notesValue) {
        setErrorMsg("Il fondo cassa e diverso da € 50,00: inserisci una nota di giustificazione.");
        const notesIndex = visibleFields.findIndex((field) => field.id === "cash_notes" || field.label.toUpperCase().includes("NOTE"));
        if (notesIndex !== -1) setActiveFieldIndex(notesIndex);
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("formId", selectedForm.id);

    const visibleFieldIds = new Set(visibleFields.map((field) => field.id));
    const answersPayload = Object.fromEntries(
      Object.entries(answers).filter(([key]) =>
        visibleFieldIds.has(key) ||
        (isSelectedClientControlForm && autoClientControlFieldIds.has(key)) ||
        key.includes("_altro") ||
        key.startsWith("participant_") ||
        key === "group_participants_count"
      )
    );
    // Replace "Altro" select options with the custom text value typed in the specified input
    Object.keys(answersPayload).forEach((key) => {
      if (answersPayload[key] === "Altro" && answersPayload[key + "_altro"]) {
        answersPayload[key] = answersPayload[key + "_altro"];
        delete answersPayload[key + "_altro"];
      }
    });

    if (isGroupCourse && !answersPayload["group_participants_count"]) {
      answersPayload["group_participants_count"] = "2";
    }

    // Non-file answers
    formData.append("answers", JSON.stringify(answersPayload));

    // File answers
    Object.entries(files).forEach(([fieldId, file]) => {
      if (visibleFieldIds.has(fieldId)) {
        formData.append(fieldId, file);
      }
    });

    try {
      const res = await fetch("/api/service-forms/submit", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Errore sconosciuto durante l'invio");
      }

      if (result.response) {
        setResponses((prev) => [result.response, ...prev]);
        if (isOrderLabelForm(result.response.form ?? selectedForm)) {
          void import("@/lib/order-label-pdf-client")
            .then(({ printOrderLabelPdf }) => printOrderLabelPdf(result.response))
            .catch((labelError) => {
              console.error("Failed to generate order label:", labelError);
            });
        }
      }

      setSuccess(true);
      setTimeout(() => {
        setSelectedForm(null);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Submission failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "Si è verificato un errore, riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 dark staff-forms-page">
      <style dangerouslySetInnerHTML={{__html: `
        body, main, #__next, .staff-forms-page {
          background-color: #050506 !important;
        }
      `}} />

      {/* Tablet cash-register shortcuts */}
      <div className="w-full">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#E8C98B]">
              <div className="size-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Terminale operativo POS
            </div>
            <h1 className="mt-3 text-3xl font-black text-white tracking-tight sm:text-4xl">Cassa & Moduli</h1>
            <p className="mt-2 text-xs font-semibold text-white/45">Interfaccia touch-friendly per la gestione rapida del salone.</p>
          </div>
        </div>

        {/* Unified POS Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {/* Card: Chiusura Cassa */}
          {cashClosingForm && (
            <button
              type="button"
              onClick={() => handleOpenForm(cashClosingForm)}
              className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#A1B5FD] to-[#d8e1ff] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#A1B5FD]/30"
              style={{ boxShadow: "0 10px 30px rgba(161,181,253,0.15)" }}
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
                <Calculator className="size-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3b4b8c] opacity-80">CASSA</p>
                <h2 className="mt-1 text-xl font-black text-[#111827] leading-tight">Chiusura Cassa</h2>
              </div>
            </button>
          )}

          {/* Card: Nuovo Ordine */}
          {orderForm && (
            <button
              type="button"
              onClick={() => handleOpenForm(orderForm)}
              className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#8DE0BD] to-[#c5f4df] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#8DE0BD]/30"
              style={{ boxShadow: "0 10px 30px rgba(141,224,189,0.15)" }}
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
                <ShoppingCart className="size-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#204a37] opacity-80">ORDINI</p>
                <h2 className="mt-1 text-xl font-black text-[#10251c] leading-tight">Nuovo Ordine</h2>
              </div>
            </button>
          )}

          {/* Card: Ritiro Ordine */}
          <button
            type="button"
            onClick={() => {
              setPickupMessage(null);
              setPickupSelectedOrder(null);
              setPickupQuery("");
              setShowPickupModal(true);
            }}
            className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#C7F9CC] to-[#F0FFF4] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#C7F9CC]/40"
            style={{ boxShadow: "0 10px 30px rgba(199,249,204,0.15)" }}
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
              <PackageCheck className="size-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#166534] opacity-80">ORDINI</p>
              <h2 className="mt-1 text-xl font-black text-[#14532d] leading-tight">Ritiro</h2>
            </div>
          </button>

          {/* Card: Pagamento Link */}
          <a
            href="https://buy.stripe.com/3cI4gAfeN2C27cjeQycIE01"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#FDCB82] to-[#FFE8B9] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#FDCB82]/30"
            style={{ boxShadow: "0 10px 30px rgba(253,203,130,0.15)" }}
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
              <CreditCard className="size-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d4615] opacity-80">FORNITORI</p>
              <h2 className="mt-1 text-xl font-black text-[#211407] leading-tight">Pagamento Link</h2>
            </div>
          </a>

          {/* Card: Richiesta Fattura Italiana */}
          {italianInvoiceForm && (
            <button
              type="button"
              onClick={() => handleOpenForm(italianInvoiceForm)}
              className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#7DD3FC] to-[#E0F2FE] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#7DD3FC]/30"
              style={{ boxShadow: "0 10px 30px rgba(125,211,252,0.15)" }}
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
                <ReceiptText className="size-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0369A1] opacity-80">FATTURAZIONE</p>
                <h2 className="mt-1 text-xl font-black text-[#0369A1] leading-tight">Fattura</h2>
              </div>
            </button>
          )}

          {/* Card: Controllo Cliente */}
          {clientControlForm && (
            <button
              type="button"
              onClick={() => handleOpenForm(clientControlForm)}
              className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#E9D5FF] to-[#F3E8FF] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#E9D5FF]/30"
              style={{ boxShadow: "0 10px 30px rgba(233,213,255,0.15)" }}
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
                <ClipboardCheck className="size-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#581C87] opacity-80">QUALITÀ</p>
                <h2 className="mt-1 text-xl font-black text-[#581C87] leading-tight">Controllo Cliente</h2>
              </div>
            </button>
          )}

          {/* Card: Candidatura */}
          {candidaturaForm && (
            <button
              type="button"
              onClick={() => handleOpenForm(candidaturaForm)}
              className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#F7A1C4] to-[#ffd5e7] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#F7A1C4]/30"
              style={{ boxShadow: "0 10px 30px rgba(247,161,196,0.15)" }}
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
                <UserPlus className="size-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#76274e] opacity-80">GENERALE</p>
                <h2 className="mt-1 text-xl font-black text-[#2b1020] leading-tight">Candidatura</h2>
              </div>
            </button>
          )}

          {/* Card: Rimborso */}
          {refundForm && (
            <button
              type="button"
              onClick={() => handleOpenForm(refundForm)}
              className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#FDA4AF] to-[#FFE4E6] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#FDA4AF]/30"
              style={{ boxShadow: "0 10px 30px rgba(253,164,175,0.15)" }}
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
                <RotateCcw className="size-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9F1239] opacity-80">AMMINISTRAZIONE</p>
                <h2 className="mt-1 text-xl font-black text-[#9F1239] leading-tight">Rimborso</h2>
              </div>
            </button>
          )}

          {/* Card: Stato Ordini Link */}
          <Link
            href="/orders"
            className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br from-[#FCA5A5] to-[#FEE2E2] p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-[#FCA5A5]/30"
            style={{ boxShadow: "0 10px 30px rgba(252,165,165,0.15)" }}
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
              <ShoppingBag className="size-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7F1D1D] opacity-80">ORDINI</p>
              <h2 className="mt-1 text-xl font-black text-[#7F1D1D] leading-tight">Stato Ordini</h2>
            </div>
          </Link>

          {/* Render any other dynamic forms from database */}
          {regularForms.map((form, idx) => {
            const colors = [
              { bg: "from-[#F3F4F6] to-[#E5E7EB]", text: "text-[#374151]", iconColor: "text-[#4B5563]", accent: "GENERALE" },
              { bg: "from-[#F0FDF4] to-[#DCFCE7]", text: "text-[#166534]", iconColor: "text-[#15803D]", accent: "INFO" },
              { bg: "from-[#FFF5F5] to-[#FFE3E3]", text: "text-[#991B1B]", iconColor: "text-[#B91C1C]", accent: "DIVERSO" },
            ];
            const color = colors[idx % colors.length];
            return (
              <button
                key={form.id}
                type="button"
                onClick={() => handleOpenForm(form)}
                className="group flex flex-col justify-between aspect-square rounded-[32px] bg-gradient-to-br p-6 text-left shadow-xl transition duration-300 hover:-translate-y-1 active:scale-[0.97] border border-black/5"
                style={{ backgroundImage: `linear-gradient(to bottom right, ${color.bg.split(" ")[1]}, ${color.bg.split(" ")[3]})`, color: color.text }}
              >
                <div className="grid size-12 place-items-center rounded-2xl bg-black/25 shadow-inner">
                  <ClipboardList className="size-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: color.iconColor }}>{form.category.toUpperCase() || color.accent}</p>
                  <h2 className="mt-1 text-xl font-black leading-tight truncate">{form.name}</h2>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PICKUP MODAL */}
      {showPickupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-5">
          <form
            onSubmit={handlePickupSubmit}
            className="max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0b0c] text-white shadow-[0_35px_120px_rgba(0,0,0,0.35)]"
          >
            <div className="border-b border-white/10 bg-white/[0.03] px-5 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                    <PackageCheck className="size-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">Ritiro ordine</p>
                    <h3 className="mt-1 text-2xl font-black">Consegna al cliente</h3>
                    <p className="mt-1 text-sm font-semibold text-white/45">Completa solo ordini in stato Arrivato / pronto.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !pickupSubmitting && setShowPickupModal(false)}
                  className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(92dvh-170px)] space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
              {pickupMessage && (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-bold",
                    pickupMessage.type === "success"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : "border-red-400/25 bg-red-400/10 text-red-200"
                  )}
                >
                  {pickupMessage.text}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Cerca ordine</span>
                  <input
                    value={pickupQuery}
                    onChange={(event) => setPickupQuery(event.target.value)}
                    placeholder="Numero ordine, nome o telefono"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-base font-black text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/50 focus:bg-white/[0.09]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Chi ritira</span>
                  <input
                    value={pickupName}
                    onChange={(event) => setPickupName(event.target.value)}
                    placeholder="Nome di chi ritira"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-base font-black text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/50 focus:bg-white/[0.09]"
                  />
                </label>
              </div>

              {pickupStatusNotice?.found && pickupStatusNotice.ready === false ? (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Ordine trovato. Stato attuale: <span className="text-amber-200">{pickupStatusNotice.statusLabel}</span>.
                    </span>
                    {pickupStatusNotice.order?.statusAudit?.changedAt ? (
                      <span className="rounded-full bg-black/20 px-3 py-1 text-xs text-amber-50/80">
                        Ultima modifica: {formatPickupDate(pickupStatusNotice.order.statusAudit.changedAt)}
                      </span>
                    ) : null}
                  </div>
                  {pickupStatusNotice.order?.pickup?.completedAt ? (
                    <p className="mt-2 text-xs font-semibold text-amber-50/75">
                      Consegnato da {pickupStatusNotice.order.pickup.completedByName || "Staff"} a{" "}
                      {pickupStatusNotice.order.pickup.pickupName || "cliente"} il {formatPickupDate(pickupStatusNotice.order.pickup.completedAt)}.
                    </p>
                  ) : pickupStatusNotice.order?.statusAudit?.changedBy ? (
                    <p className="mt-2 text-xs font-semibold text-amber-50/75">
                      Stato modificato da {pickupStatusNotice.order.statusAudit.changedBy}.
                    </p>
                  ) : null}
                </div>
              ) : pickupStatusNotice?.found === false ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/45">
                  Nessun ordine trovato con questa ricerca.
                </div>
              ) : null}

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Ordini pronti</p>
                    <p className="text-xs font-semibold text-white/40">Clicca un ordine per vedere pagato, saldo mancante e dettagli.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadPickupReadyOrders()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/10"
                  >
                    {pickupLoadingOrders ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                    Aggiorna
                  </button>
                </div>

                <div className="grid max-h-72 gap-3 overflow-y-auto pr-1">
                  {pickupLoadingOrders ? (
                    <div className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 text-sm font-bold text-white/50">
                      <Loader2 className="size-4 animate-spin" />
                      Carico ordini pronti...
                    </div>
                  ) : filteredPickupReadyOrders.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-bold text-white/45">
                      Nessun ordine in Arrivato / pronto.
                    </div>
                  ) : (
                    filteredPickupReadyOrders.map((order) => {
                      const selected = pickupSelectedOrder?.id === order.id;
                      const missing = order.payment?.missing;
                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => {
                            setPickupSelectedOrder(order);
                            setPickupQuery(order.orderNumber || order.clientName);
                            setPickupStatusNotice(null);
                          }}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition active:scale-[0.99]",
                            selected
                              ? "border-emerald-300/60 bg-emerald-300/12"
                              : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-white">{order.clientName}</p>
                              <p className="mt-0.5 text-xs font-bold text-white/45">
                                {order.orderNumber} {order.phone ? `· ${order.phone}` : ""} {order.salon ? `· ${order.salon}` : ""}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-3 py-1 text-[11px] font-black",
                                missing && missing > 0 ? "bg-rose-400/15 text-rose-200" : "bg-emerald-300/15 text-emerald-200"
                              )}
                            >
                              {missing !== null && missing !== undefined ? `Manca ${formatEuro(missing)}` : "Saldo da verificare"}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs font-bold text-white/55 sm:grid-cols-3">
                            <span className="rounded-xl bg-black/25 px-3 py-2">Pagato: {formatEuro(order.payment?.paid ?? 0)}</span>
                            <span className="rounded-xl bg-black/25 px-3 py-2">Totale: {formatEuro(order.payment?.total)}</span>
                            <span className="rounded-xl bg-black/25 px-3 py-2">Creato: {formatPickupDate(order.createdAt) || "-"}</span>
                          </div>
                          {selected && order.summary ? (
                            <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-xs font-semibold leading-5 text-white/50">{order.summary}</p>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {pickupSelectedOrder ? (
                <div className="space-y-3 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Ordine selezionato</p>
                      <p className="mt-1 text-xl font-black text-white">{pickupSelectedOrder.clientName}</p>
                      <p className="text-xs font-bold text-white/45">
                        {pickupSelectedOrder.phone || "Telefono non indicato"} {pickupSelectedOrder.createdBy ? `· Creato da ${pickupSelectedOrder.createdBy}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-black",
                        pickupSelectedOrder.status === "READY"
                          ? "bg-blue-300/15 text-blue-100"
                          : pickupSelectedOrder.status === "COMPLETED"
                            ? "bg-emerald-300/15 text-emerald-100"
                            : "bg-amber-300/15 text-amber-100"
                      )}
                    >
                      {pickupSelectedOrder.statusLabel || pickupSelectedOrder.status || "Stato non indicato"}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/70">Ordine</p>
                      <p className="mt-1 font-black">{pickupSelectedOrder.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/70">Pagato</p>
                      <p className="mt-1 font-black">{formatEuro(pickupSelectedOrder.payment?.paid ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/70">Manca</p>
                      <p className="mt-1 font-black">{formatEuro(pickupSelectedOrder.payment?.missing)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/70">Salone</p>
                      <p className="mt-1 font-black">{pickupSelectedOrder.salon || "-"}</p>
                    </div>
                  </div>
                  {pickupSelectedOrder.statusAudit || pickupSelectedOrder.pickup ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Ultimo stato</p>
                        <p className="mt-2 text-sm font-black text-white">{pickupSelectedOrder.statusLabel || pickupSelectedOrder.status || "-"}</p>
                        <p className="mt-1 text-xs font-semibold text-white/45">
                          {pickupSelectedOrder.statusAudit?.changedBy ? `Da ${pickupSelectedOrder.statusAudit.changedBy}` : "Operatore non indicato"}
                          {pickupSelectedOrder.statusAudit?.changedAt ? ` · ${formatPickupDate(pickupSelectedOrder.statusAudit.changedAt)}` : ""}
                        </p>
                        {pickupSelectedOrder.statusAudit?.text ? (
                          <p className="mt-2 text-xs font-semibold leading-5 text-white/50">{pickupSelectedOrder.statusAudit.text}</p>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Consegna</p>
                        {pickupSelectedOrder.pickup?.completedAt ? (
                          <>
                            <p className="mt-2 text-sm font-black text-white">
                              {pickupSelectedOrder.pickup.pickupName || "Cliente"} · {formatPickupDate(pickupSelectedOrder.pickup.completedAt)}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-white/45">
                              Consegnato da {pickupSelectedOrder.pickup.completedByName || "Staff"}
                            </p>
                            {pickupProofUrl(pickupSelectedOrder) ? (
                              <a
                                href={pickupProofUrl(pickupSelectedOrder)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                              >
                                <Eye className="size-3.5" />
                                Vedi prova consegna
                              </a>
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-2 text-sm font-bold text-white/45">Non ancora consegnato.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {pickupSelectedOrder.notes ? (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Tutte le note ordine</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-amber-50">{pickupSelectedOrder.notes}</p>
                    </div>
                  ) : null}
                  {pickupSelectedOrder.attachments?.length ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/70">Foto e allegati ordine</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {pickupSelectedOrder.attachments.map((attachment, index) => (
                          <a
                            key={`${attachment.url}-${index}`}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] transition hover:border-emerald-300/40 hover:bg-white/[0.09]"
                          >
                            {attachment.previewable ? (
                              <img src={attachment.url} alt={attachment.name} className="h-36 w-full object-cover" />
                            ) : (
                              <div className="grid h-24 place-items-center bg-black/20">
                                <FileText className="size-8 text-white/35" />
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3 p-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black uppercase tracking-[0.14em] text-white/35">{attachment.label}</p>
                                <p className="mt-1 truncate text-sm font-black text-white">{attachment.name}</p>
                              </div>
                              <ArrowUpRight className="size-4 shrink-0 text-white/35 transition group-hover:text-emerald-200" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/70">Info ordine completa</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {pickupOrderDetails(pickupSelectedOrder).map((detail, index) => (
                        <div key={`${detail.label}-${index}`} className="rounded-2xl bg-white/[0.06] p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">{detail.label}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold leading-5 text-white/80">{detail.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">PIN firma consegna</span>
                <input
                  value={pickupPin}
                  onChange={(event) => setPickupPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  type="password"
                  placeholder="PIN personale"
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-base font-black text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/50 focus:bg-white/[0.09]"
                />
                <span className="block text-xs font-semibold text-white/35">Il PIN firma chi ha consegnato l'ordine al cliente.</span>
              </label>

              <button
                type="button"
                onClick={() => setPickupPaidConfirmed((current) => !current)}
                className={cn(
                  "flex min-h-16 w-full items-center justify-between rounded-2xl border px-4 text-left transition active:scale-[0.99]",
                  pickupPaidConfirmed
                    ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]"
                )}
              >
                <span>
                  <span className="block text-sm font-black">Ha saldato tutto?</span>
                  <span className="block text-xs font-semibold text-white/40">Conferma obbligatoria prima di completare.</span>
                </span>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full border",
                    pickupPaidConfirmed ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/20"
                  )}
                >
                  {pickupPaidConfirmed && <Check className="size-4" />}
                </span>
              </button>

              <label className="group relative flex min-h-36 w-full items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.04] transition hover:border-emerald-300/50 hover:bg-white/[0.07]">
                <input
                  type="file"
                  accept="image/*,.heic,.heif,application/pdf"
                  onChange={(event) => setPickupProof(event.target.files?.[0] ?? null)}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <div className="pointer-events-none flex flex-col items-center p-5 text-center">
                  <Upload className="size-9 text-white/35 transition group-hover:text-emerald-300" />
                  <span className="mt-3 text-sm font-black text-white">
                    {pickupProof ? pickupProof.name : "Carica foto scontrino o ordine Shopify"}
                  </span>
                  <span className="mt-1 text-[11px] font-semibold text-white/35">Facoltativo se il saldo e gia stato verificato. Foto o PDF, massimo 12 MB.</span>
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.03] px-5 py-4 sm:px-7">
              {pickupMessage ? (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-black",
                    pickupMessage.type === "success"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : "border-red-400/25 bg-red-400/10 text-red-200"
                  )}
                >
                  {pickupMessage.text}
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={pickupSubmitting}
                onClick={() => setShowPickupModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/10 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={pickupSubmitting || (!!pickupSelectedOrder && pickupSelectedOrder.status !== "READY")}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-black transition hover:scale-[1.02] disabled:opacity-50"
              >
                {pickupSubmitting ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
                Completa ritiro
              </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* FILL OUT MODAL */}
      {selectedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-5">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white text-slate-900 shadow-[0_35px_120px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200">
            <div className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(167,71,88,0.06),transparent_40%),linear-gradient(135deg,#f8fafc,#ffffff_60%)] px-5 py-5 sm:px-7">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[#A74758] via-[#ff8bb2] to-transparent" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-100 bg-slate-50 shadow-sm">
                    <DynamicIcon name={selectedForm.icon || "ClipboardList"} className="size-6 text-[#A74758]" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full border border-[#A74758]/20 bg-[#A74758]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#A74758]">
                      {selectedForm.category}
                    </span>
                    <h3 className="mt-2 truncate text-xl font-black text-slate-900 sm:text-2xl">{selectedForm.name}</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {visibleFields.length > 0
                        ? `Domanda ${currentActiveIndex + 1} di ${visibleFields.length} · ${answeredVisibleCount} compilate`
                        : "Modulo pronto per la compilazione"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setSelectedForm(null)}
                  className="grid size-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="size-5" />
                </button>
              </div>

              {!success && visibleFields.length > 0 && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>Progresso compilazione</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-[#A74758] via-[#ff7fb0] to-[#F7DFA7] transition-all duration-500 ease-out" 
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {visibleFields.map((field, index) => {
                      const isActive = index === currentActiveIndex;
                      const isDone = field.type === "file"
                        ? Boolean(files[field.id])
                        : Boolean(answers[field.id] !== undefined && answers[field.id] !== null && String(answers[field.id]).trim() !== "");
                      return (
                        <button
                          key={field.id}
                          type="button"
                          onClick={() => {
                            setErrorMsg("");
                            setActiveFieldIndex(index);
                          }}
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-full border text-[11px] font-black transition",
                            isActive
                              ? "border-[#A74758] bg-[#A74758] text-white"
                              : isDone
                                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                          )}
                          title={field.label}
                        >
                          {isDone && !isActive ? <Check className="size-3.5" /> : index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {success ? (
              <div className="flex flex-1 flex-col items-center justify-center p-12 text-center bg-white">
                <div className="grid size-20 place-items-center rounded-full border border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="size-10 text-emerald-500" />
                </div>
                <h3 className="mt-5 text-2xl font-black text-slate-900">Inviato con successo</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">Il modulo è stato salvato e sincronizzato. Puoi chiudere questa finestra.</p>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNextOrSubmit();
                }} 
                className="flex min-h-[430px] flex-1 flex-col justify-between overflow-y-auto p-5 sm:p-7 bg-white"
              >
                <div className="space-y-5 flex-1">
                  {selectedForm.description && currentActiveIndex === 0 && (
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                      {selectedForm.description}
                    </div>
                  )}

                  {errorMsg && (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                      <AlertCircle className="size-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {visibleFields.length > 0 && (() => {
                    const field = visibleFields[currentActiveIndex];
                    if (!field) return null;

                    return (
                      <div 
                        key={field.id} 
                        className="animate-in fade-in slide-in-from-right-5 duration-300"
                      >
                        <div className="rounded-[28px] border border-slate-100 bg-slate-50/50 p-5 shadow-sm sm:p-6">
                          <div className="mb-5 space-y-2">
                            <span className="inline-flex rounded-full bg-slate-200/50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Campo {currentActiveIndex + 1}
                            </span>
                            <label className="block text-xl font-black leading-tight text-slate-900 sm:text-2xl">
                              {field.label} {field.required && <span className="text-[#A74758]">*</span>}
                            </label>
                            {field.description && (
                              <p className="text-sm leading-relaxed text-slate-500">{field.description}</p>
                            )}
                          </div>

                          <div>
                          {field.type === "text" && (
                            <div className="relative flex flex-col gap-2 w-full">
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  required={field.required}
                                  value={answers[field.id] || ""}
                                  onChange={(e) => handleTextChange(field.id, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, field.type)}
                                  placeholder="Scrivi qui..."
                                  className={cn(
                                    "h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white",
                                    (field.id === "invoice_vat_number" || field.id === "invoice_shopify_order") && "pr-32"
                                  )}
                                />
                                {field.id === "invoice_vat_number" && (
                                  <button
                                    type="button"
                                    onClick={handleVatLookup}
                                    disabled={loadingVat}
                                    className="absolute right-2 h-10 px-4 rounded-xl bg-[#A74758] hover:bg-[#8e3948] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-black transition flex items-center gap-1.5 active:scale-[0.98]"
                                  >
                                    {loadingVat ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Search className="size-3.5" />
                                    )}
                                    Cerca
                                  </button>
                                )}
                                {field.id === "invoice_shopify_order" && (
                                  <button
                                    type="button"
                                    onClick={handleShopifyOrderLookup}
                                    disabled={loadingShopify}
                                    className="absolute right-2 h-10 px-4 rounded-xl bg-[#A74758] hover:bg-[#8e3948] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-black transition flex items-center gap-1.5 active:scale-[0.98]"
                                  >
                                    {loadingShopify ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Download className="size-3.5" />
                                    )}
                                    Importa
                                  </button>
                                )}
                              </div>
                              {field.id === "invoice_vat_number" && vatLookupStatus && (
                                <div className={cn(
                                  "text-xs font-semibold px-4 py-3 whitespace-pre-line rounded-2xl border animate-in fade-in slide-in-from-top-1 duration-200 mt-2",
                                  vatLookupStatus.success 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                    : "bg-red-50 border-red-200 text-red-700"
                                )}>
                                  {vatLookupStatus.message}
                                </div>
                              )}
                              {field.id === "invoice_shopify_order" && shopifyLookupStatus && (
                                <div className={cn(
                                  "text-xs font-semibold px-4 py-3 whitespace-pre-line rounded-2xl border animate-in fade-in slide-in-from-top-1 duration-200 mt-2",
                                  shopifyLookupStatus.success 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                    : "bg-red-50 border-red-200 text-red-700"
                                )}>
                                  {shopifyLookupStatus.message}
                                </div>
                              )}
                            </div>
                          )}

                          {field.type === "textarea" && (
                            <textarea
                              required={field.required}
                              value={answers[field.id] || ""}
                              onChange={(e) => handleTextChange(field.id, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, field.type)}
                              rows={5}
                              placeholder="Aggiungi dettagli..."
                              className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-base font-semibold text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white"
                            />
                          )}

                          {field.type === "number" && (
                            <input
                              type="number"
                              required={field.required}
                              value={answers[field.id] || ""}
                              onChange={(e) => handleTextChange(field.id, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, field.type)}
                              placeholder="0"
                              className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white"
                            />
                          )}

                          {field.type === "select" && (
                            <div className="space-y-2.5 w-full">
                              {field.id === "invoice_client_type" && showPastCustomers ? (
                                <div className="space-y-3.5 w-full">
                                  <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-black text-slate-800">Seleziona Cliente Registrato</h4>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowPastCustomers(false);
                                        setCustomerSearchQuery("");
                                      }}
                                      className="text-xs font-bold text-[#A74758] hover:underline"
                                    >
                                      Annulla
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={customerSearchQuery}
                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                    placeholder="Cerca per nome, codice fiscale o P.IVA..."
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#A74758]"
                                  />
                                  <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-100 rounded-2xl bg-white p-2">
                                    {(() => {
                                      const filtered = pastCustomers.filter(c => 
                                        c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                        c.fiscalCode.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                        c.vatNumber.toLowerCase().includes(customerSearchQuery.toLowerCase())
                                      );
                                      if (filtered.length === 0) {
                                        return <p className="text-xs text-slate-400 text-center py-4">Nessun cliente registrato corrisponde alla ricerca.</p>;
                                      }
                                      return filtered.map((cust) => (
                                        <button
                                          key={cust.name}
                                          type="button"
                                          onClick={() => handleSelectCustomer(cust)}
                                          className="flex w-full items-center justify-between rounded-xl p-3 text-left transition hover:bg-slate-50 border border-transparent hover:border-slate-100"
                                        >
                                          <div>
                                            <p className="text-sm font-black text-slate-900">{cust.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                              {cust.vatNumber ? `P.IVA: ${cust.vatNumber}` : `CF: ${cust.fiscalCode.toUpperCase()}`}
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-black uppercase text-[#A74758] bg-[#A74758]/10 px-2.5 py-0.5 rounded-full">
                                            {cust.type.includes("Azienda") ? "Azienda" : "Privato"}
                                          </span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                    {field.options?.map((opt) => {
                                      const isSelected = answers[field.id] === opt;
                                      return (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => handleSelectChange(field.id, opt)}
                                          className={cn(
                                            "flex min-h-14 w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                                            isSelected
                                              ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758] shadow-sm shadow-[#A74758]/5"
                                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                          )}
                                        >
                                          <span>{opt}</span>
                                          <div className={cn(
                                            "size-5 rounded-full border flex items-center justify-center transition-all",
                                            isSelected 
                                              ? "border-[#A74758] bg-[#A74758]/15 text-[#A74758]" 
                                              : "border-slate-200 bg-slate-50"
                                          )}>
                                            {isSelected && <Check className="size-3" />}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {answers[field.id] === "Altro" && (
                                    <input
                                      type="text"
                                      required={field.required}
                                      placeholder="Specifica..."
                                      value={answers[field.id + "_altro"] || ""}
                                      onChange={(e) => handleTextChange(field.id + "_altro", e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(e, "text")}
                                      className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white"
                                    />
                                  )}
                                  {field.id === "invoice_client_type" && pastCustomers.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                                      <p className="text-xs font-bold text-slate-400">Cliente già registrato in passato?</p>
                                      <button
                                        type="button"
                                        onClick={() => setShowPastCustomers(true)}
                                        className="flex h-14 w-full items-center justify-between rounded-2xl border border-dashed border-[#A74758]/30 bg-[#A74758]/5 px-4 text-left text-sm font-extrabold text-[#A74758] transition hover:bg-[#A74758]/10 hover:border-[#A74758]/50 active:scale-[0.99]"
                                      >
                                        <span className="flex items-center gap-2">
                                          <Search className="size-4" />
                                          Cerca tra i Clienti Registrati
                                        </span>
                                        <span className="rounded-full bg-[#A74758] px-2.5 py-0.5 text-[10px] text-white">
                                          {pastCustomers.length}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {field.type === "money" && (
                            <div className="relative flex items-center">
                              <span className="absolute left-4 text-base font-black text-slate-400">€</span>
                              <input
                                type="number"
                                step="0.01"
                                required={field.required}
                                value={answers[field.id] || ""}
                                onChange={(e) => handleTextChange(field.id, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, field.type)}
                                className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-4 text-base font-semibold text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white"
                                placeholder="0.00"
                              />
                            </div>
                          )}

                          {field.type === "date" && (
                            <input
                              type="date"
                              required={field.required}
                              value={answers[field.id] || ""}
                              onChange={(e) => handleTextChange(field.id, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, field.type)}
                              className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white"
                            />
                          )}

                          {field.type === "pin" && (
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              autoComplete="one-time-code"
                              required={field.required}
                              value={answers[field.id] || ""}
                              onChange={(e) => handleTextChange(field.id, e.target.value.replace(/\D/g, "").slice(0, 6))}
                              onKeyDown={(e) => handleKeyDown(e, field.type)}
                              placeholder="Inserisci PIN personale"
                              className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center text-2xl font-black tracking-[0.35em] text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white"
                            />
                          )}

                          {field.type === "worker" && (
                            <select
                              required={field.required}
                              value={answers[field.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAnswers((prev) => ({ ...prev, [field.id]: val }));
                                if (val) {
                                  setTimeout(() => {
                                    setActiveFieldIndex((prevIndex) => {
                                      if (prevIndex < visibleFields.length - 1) {
                                        return prevIndex + 1;
                                      }
                                      return prevIndex;
                                    });
                                  }, 350);
                                }
                              }}
                              className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-[#A74758] focus:ring-1 focus:ring-[#A74758]/20 focus:bg-white"
                            >
                              <option value="" className="bg-white text-black">Seleziona collaboratore...</option>
                              {employees.map((emp) => (
                                <option key={emp.id} value={emp.name} className="bg-white text-black">
                                  {emp.name}
                                </option>
                              ))}
                            </select>
                          )}

                          {field.type === "worker_multi" && (
                            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                              {employees.map((emp) => {
                                const selected = Array.isArray(answers[field.id]) && answers[field.id].includes(emp.name);
                                return (
                                  <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => toggleWorkerMulti(field.id, emp.name)}
                                    className={cn(
                                      "flex min-h-12 items-center justify-between rounded-2xl border px-4 text-left text-sm font-black transition active:scale-[0.99]",
                                      selected
                                        ? "border-[#A74758] bg-[#A74758]/10 text-[#A74758]"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                  >
                                    <span>{emp.name}</span>
                                    <span className={cn(
                                      "grid size-5 place-items-center rounded-full border",
                                      selected ? "border-[#A74758] bg-[#A74758] text-white" : "border-slate-200"
                                    )}>
                                      {selected && <Check className="size-3.5" />}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {field.type === "checkbox" && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = answers[field.id] !== true;
                                setAnswers((prev) => ({ ...prev, [field.id]: next }));
                                setErrorMsg("");
                              }}
                              className={cn(
                                "flex min-h-16 w-full items-center justify-between rounded-2xl border p-4 text-left transition active:scale-[0.99]",
                                answers[field.id] === true
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              )}
                            >
                              <span className="text-sm font-black">{field.description || field.label}</span>
                              <span className={cn(
                                "grid size-7 place-items-center rounded-full border",
                                answers[field.id] === true ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200"
                              )}>
                                {answers[field.id] === true && <Check className="size-4" />}
                              </span>
                            </button>
                          )}

                          {field.type === "file" && (
                            <div className="group relative flex min-h-40 w-full items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white transition hover:border-[#A74758]/60 hover:bg-[#A74758]/5">
                              <input
                                type="file"
                                required={field.required && !files[field.id]}
                                onChange={(e) => handleFileChange(field.id, e)}
                                accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="flex flex-col items-center p-5 text-center pointer-events-none">
                                <Upload className="size-9 text-slate-400 transition group-hover:text-[#A74758]" />
                                <span className="mt-3 text-sm font-bold text-slate-700">
                                  {files[field.id] ? files[field.id].name : "Carica o trascina un file"}
                                </span>
                                {!files[field.id] && (
                                  <span className="text-[10px] text-slate-400 mt-1">Dimensione max: 15 MB</span>
                                )}
                              </div>
                            </div>
                          )}

                          {field.id === participaField?.id && isGroupCourse && (
                            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                              <label className="text-sm font-bold text-slate-700 block">
                                Numero di Corsisti (Partecipanti) <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={answers["group_participants_count"] || "2"}
                                onChange={(e) => {
                                  handleTextChange("group_participants_count", e.target.value);
                                }}
                                className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#A74758]"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                  <option key={num} value={String(num)} className="bg-white text-black">
                                    {num} {num === 1 ? "Corsista" : "Corsisti"}
                                  </option>
                                ))}
                              </select>

                              <div className="space-y-6 pt-4 border-t border-slate-200">
                                {Array.from({ length: groupCount }).map((_, idx) => {
                                  const pIndex = idx + 1;
                                  return (
                                    <div key={pIndex} className="p-4 rounded-xl bg-white border border-slate-100 space-y-3 text-left">
                                      <h5 className="text-xs font-bold uppercase tracking-wider text-[#A74758]">
                                        Dati Corsista #{pIndex}
                                      </h5>

                                      <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-slate-500">Nome e Cognome <span className="text-red-500">*</span></label>
                                          <input
                                            type="text"
                                            required
                                            value={answers[`participant_${pIndex}_name`] || ""}
                                            onChange={(e) => handleTextChange(`participant_${pIndex}_name`, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, "text")}
                                            className="h-10 w-full rounded-lg bg-white border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-[#A74758]"
                                            placeholder="Nome e cognome"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-slate-500">Codice Fiscale <span className="text-red-500">*</span></label>
                                          <input
                                            type="text"
                                            required
                                            value={answers[`participant_${pIndex}_cf`] || ""}
                                            onChange={(e) => handleTextChange(`participant_${pIndex}_cf`, e.target.value.toUpperCase())}
                                            onKeyDown={(e) => handleKeyDown(e, "text")}
                                            className="h-10 w-full rounded-lg bg-white border border-slate-200 px-3 text-xs font-mono text-slate-800 outline-none focus:border-[#A74758]"
                                            placeholder="Codice fiscale"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-slate-500">Email <span className="text-red-500">*</span></label>
                                          <input
                                            type="email"
                                            required
                                            value={answers[`participant_${pIndex}_email`] || ""}
                                            onChange={(e) => handleTextChange(`participant_${pIndex}_email`, e.target.value.toLowerCase())}
                                            onKeyDown={(e) => handleKeyDown(e, "text")}
                                            className="h-10 w-full rounded-lg bg-white border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-[#A74758]"
                                            placeholder="Indirizzo email"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-slate-500">Telefono <span className="text-red-500">*</span></label>
                                          <input
                                            type="tel"
                                            required
                                            value={answers[`participant_${pIndex}_phone`] || ""}
                                            onChange={(e) => handleTextChange(`participant_${pIndex}_phone`, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, "text")}
                                            className="h-10 w-full rounded-lg bg-white border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-[#A74758]"
                                            placeholder="Numero cellulare"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500">Dati Professionali e Altre Info</label>
                                        <textarea
                                          value={answers[`participant_${pIndex}_notes`] || ""}
                                          onChange={(e) => handleTextChange(`participant_${pIndex}_notes`, e.target.value)}
                                          rows={2}
                                          className="w-full rounded-lg bg-white border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-[#A74758] resize-none"
                                          placeholder="Dati professionali, mansione o altre informazioni..."
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer buttons */}
                <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between border-t border-slate-100 bg-white/95 px-5 pt-4 backdrop-blur sm:-mx-7 sm:px-7">
                  <div>
                    <Button
                      type="button"
                      variant="soft"
                      onClick={() => {
                        if (currentActiveIndex > 0) {
                          setErrorMsg("");
                          setActiveFieldIndex(currentActiveIndex - 1);
                        } else {
                          setSelectedForm(null);
                        }
                      }}
                      className="rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Indietro
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="soft"
                      disabled={submitting}
                      onClick={() => setSelectedForm(null)}
                      className="rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Annulla
                    </Button>

                    {currentActiveIndex < visibleFields.length - 1 ? (
                      <Button
                        type="submit"
                        className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-[#A74758] px-5 py-2 text-sm font-extrabold text-white transition hover:scale-[1.02]"
                      >
                        Continua
                        <ChevronRight className="size-4" />
                      </Button>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleNextOrSubmit()}
                        className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#A74758] to-[#c6556c] px-5 py-2 text-sm font-extrabold text-white shadow-lg shadow-[#A74758]/20 transition hover:scale-[1.02] disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Invio in corso...
                          </>
                        ) : (
                          "Invia Risposte"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* HISTORY / SUBMISSIONS LIST MODAL */}
      {selectedFormForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[80vh] w-full max-w-2xl rounded-[28px] bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  Cronologia e Invii
                </span>
                <h3 className="text-lg font-bold text-white">{selectedFormForHistory.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFormForHistory(null)}
                className="grid size-8 place-items-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-white/60">
                  Visualizza le risposte inviate da te o quelle in cui sei stato taggato/notificato.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenForm(selectedFormForHistory);
                    setSelectedFormForHistory(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#A74758] text-white px-3.5 py-2 text-xs font-semibold hover:scale-[1.02] transition"
                >
                  <Plus className="size-3.5" />
                  Compila Nuovo
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      <th className="px-4 py-2.5">Data Invio</th>
                      <th className="px-4 py-2.5">Dipendente</th>
                      <th className="px-4 py-2.5">Commenti</th>
                      <th className="px-4 py-2.5 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-xs">
                    {formSubmissions.map((resp) => {
                      const commentsCount = Array.isArray(resp.comments) 
						? resp.comments.length 
						: typeof resp.comments === "string" 
						  ? (() => {
							  try { return JSON.parse(resp.comments || "[]").length; } catch { return 0; }
							})()
						  : 0;
                      const isOwnSubmission = resp.user_id === currentUserId;

                      return (
                        <tr key={resp.id} className="hover:bg-white/5 transition">
                          <td className="px-4 py-3 font-semibold text-white/80">
                            {new Date(resp.created_at).toLocaleDateString("it-IT", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-white">
                              {isOwnSubmission ? "Tu" : resp.user?.name || "Collaboratore"}
                            </span>
                            {!isOwnSubmission && (
                              <span className="ml-1 text-[9px] bg-blue-950/50 text-blue-300 border border-blue-900 rounded px-1 font-bold">
                                Ricevuto
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {commentsCount > 0 ? (
                              <span className="font-bold text-[#A74758] flex items-center gap-1">
                                <MessageSquare className="size-3" />
                                {commentsCount}
                              </span>
                            ) : (
                              <span className="text-white/35">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedResponse(resp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-white/10 transition"
                            >
                              <Eye className="size-3" />
                              Vedi e Rispondi
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {formSubmissions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-white/40 italic">
                          Nessun invio presente per questo modulo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end bg-white/5 px-6 py-4 border-t border-white/10">
              <Button type="button" onClick={() => setSelectedFormForHistory(null)} className="bg-white/5 text-white hover:bg-white/10">
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSE DETAIL VIEWER MODAL */}
      {selectedResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[85vh] w-full max-w-2xl rounded-[28px] bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  Dettagli Invio / Risposta
                </span>
                <h3 className="text-lg font-bold text-white">
                  {selectedResponse.form?.name || "Dettagli Modulo"}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedResponse(null)}
                className="grid size-8 place-items-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Submitter Metadata */}
              <div className="grid gap-3 grid-cols-2 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-white/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-white/40 uppercase">Dipendente</span>
                    <span className="font-semibold text-white">{selectedResponse.user?.name || "Tu"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-white/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-white/40 uppercase">Sede</span>
                    <span className="font-semibold text-white">{selectedResponse.user_location_name || "Nessuna"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2 border-t border-white/10 pt-2 mt-1">
                  <Calendar className="size-4 text-white/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-white/40 uppercase">Inviato il</span>
                    <span className="font-semibold text-white">
                      {new Date(selectedResponse.created_at).toLocaleString("it-IT")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Answers Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Risposte alle Domande</h4>
                
                {selectedResponse.form?.fields ? (
                  (selectedResponse.form.fields as any[]).map((field) => {
                    if (isResponseCorsistiForm && isResponseGroupCourse && isDefaultParticipantField(field.label)) {
                      return null;
                    }

                    const answer = selectedResponse.answers[field.id];
                    
                    return (
                      <div key={field.id} className="border-b border-white/10 pb-3">
                        <span className="block text-xs font-bold text-white/40">{field.label}</span>
                        
                        <div className="mt-1 text-sm text-white">
                          {editingFieldId === field.id ? (
                            <div className="space-y-2 mt-1">
                              {field.type === "textarea" ? (
                                <textarea
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-full rounded-xl bg-white border border-[#A74758] p-3 text-sm text-black outline-none focus:border-[#A74758] min-h-[80px]"
                                  autoFocus
                                />
                              ) : field.type === "select" ? (
                                <div className="space-y-2.5 w-full">
                                  <select
                                    value={editingValue}
                                    onChange={(e) => {
                                      setEditingValue(e.target.value);
                                      if (e.target.value !== "Altro") {
                                        setCustomSelectValue("");
                                      }
                                    }}
                                    className="w-full h-11 rounded-xl bg-white border border-[#A74758] px-3 text-sm text-black outline-none focus:border-[#A74758]"
                                    autoFocus
                                  >
                                    <option value="">Seleziona un'opzione...</option>
                                    {field.options?.map((opt: string) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                    <option value="Altro">Altro...</option>
                                  </select>
                                  {editingValue === "Altro" && (
                                    <input
                                      type="text"
                                      placeholder="Specifica..."
                                      value={customSelectValue}
                                      onChange={(e) => setCustomSelectValue(e.target.value)}
                                      className="w-full h-11 rounded-xl bg-white border border-[#A74758] px-4 text-sm text-black outline-none focus:border-[#A74758]"
                                    />
                                  )}
                                </div>
                              ) : (
                                <input
                                  type={field.type === "number" || field.type === "money" ? "number" : field.type === "date" ? "date" : "text"}
                                  step={field.type === "money" ? "0.01" : undefined}
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const finalVal = editingValue === "Altro" ? customSelectValue : editingValue;
                                      handleSaveAnswer(field.id, finalVal);
                                    } else if (e.key === "Escape") {
                                      setEditingFieldId(null);
                                    }
                                  }}
                                  className="w-full h-11 rounded-xl bg-white border border-[#A74758] px-4 text-sm text-black outline-none focus:border-[#A74758]"
                                  autoFocus
                                />
                              )}
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditingFieldId(null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white/50 hover:text-white rounded-lg bg-white/5 border border-white/10 transition"
                                >
                                  <X className="size-3.5" /> Annulla
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const finalVal = editingValue === "Altro" ? customSelectValue : editingValue;
                                    handleSaveAnswer(field.id, finalVal);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-[#A74758] transition hover:scale-[1.02]"
                                >
                                  <Check className="size-3.5" /> Salva
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={() => {
                                if (field.type !== "file") {
                                  setEditingFieldId(field.id);
                                  setEditingValue(answer === undefined || answer === null ? "" : String(answer));
                                  setCustomSelectValue("");
                                }
                              }}
                              className={cn(
                                "group/answer relative transition-all duration-200 rounded-xl",
                                field.type !== "file" && "cursor-pointer hover:ring-1 hover:ring-[#A74758]/50"
                              )}
                            >
                              {answer === undefined || answer === null || answer === "" ? (
                                <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center justify-between text-white">
                                  <span className="text-white/30 italic">Nessuna risposta</span>
                                  {field.type !== "file" && <Pencil className="size-3.5 text-white/0 group-hover/answer:text-white/30 transition-colors animate-in fade-in duration-200" />}
                                </div>
                              ) : field.type === "file" && typeof answer === "object" ? (
                                <div className="space-y-3 mt-1.5">
                                  {(String(answer.type ?? "").startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(answer.name)) && (
                                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 max-w-sm aspect-video flex items-center justify-center group/img">
                                      <img
                                        src={`/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}`}
                                        alt={answer.name}
                                        className="object-contain max-h-48 w-full transition group-hover/img:scale-[1.02]"
                                      />
                                    </div>
                                  )}
                                  {(String(answer.type ?? "").startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(answer.name)) && (
                                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black max-w-sm aspect-video flex items-center justify-center">
                                      <video
                                        src={`/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}`}
                                        controls
                                        playsInline
                                        className="max-h-48 w-full"
                                      />
                                    </div>
                                  )}
                                  <a
                                    href={`/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#A74758] shadow-sm hover:bg-white/10 transition"
                                  >
                                    <Download className="size-3.5" />
                                    Scarica: {answer.name}
                                  </a>
                                </div>
                              ) : field.type === "checkbox" ? (
                                <div className="whitespace-pre-line leading-relaxed font-semibold bg-white/5 p-3 rounded-xl border border-white/10 text-white flex items-center justify-between">
                                  <span>{answer === true ? "Si, fatto" : "No"}</span>
                                  <Pencil className="size-3.5 text-white/0 group-hover/answer:text-white/30 transition-colors animate-in fade-in duration-200" />
                                </div>
                              ) : field.type === "worker_multi" && Array.isArray(answer) ? (
                                <div className="flex flex-wrap gap-2 bg-white/5 p-3 rounded-xl border border-white/10">
                                  {answer.length > 0 ? answer.map((name: string) => (
                                    <span key={name} className="rounded-full bg-[#A74758]/20 px-3 py-1 text-xs font-black text-[#ffb7cf]">{name}</span>
                                  )) : <span className="text-white/30 italic">Nessuna risposta</span>}
                                  <Pencil className="ml-auto size-3.5 text-white/0 group-hover/answer:text-white/30 transition-colors animate-in fade-in duration-200" />
                                </div>
                              ) : field.type === "money" ? (
                                <div className="whitespace-pre-line leading-relaxed font-semibold bg-white/5 p-3 rounded-xl border border-white/10 text-[#A74758] flex items-center justify-between">
                                  <span>
                                    € {(() => {
                                      const val = parseFloat(answer);
                                      return isNaN(val) ? String(answer) : val.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                    })()}
                                  </span>
                                  <Pencil className="size-3.5 text-white/0 group-hover/answer:text-[#A74758]/65 transition-colors animate-in fade-in duration-200" />
                                </div>
                              ) : field.type === "date" ? (
                                <div className="whitespace-pre-line leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/10 text-white flex items-center justify-between">
                                  <span>
                                    {(() => {
                                      const parts = String(answer).split("-");
                                      if (parts.length === 3) {
                                        return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                      }
                                      return String(answer);
                                    })()}
                                  </span>
                                  <Pencil className="size-3.5 text-white/0 group-hover/answer:text-white/30 transition-colors animate-in fade-in duration-200" />
                                </div>
                              ) : (
                                <div className="whitespace-pre-line leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/10 text-white flex items-center justify-between">
                                  <span>{String(answer)}</span>
                                  <Pencil className="size-3.5 text-white/0 group-hover/answer:text-white/30 transition-colors animate-in fade-in duration-200" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {field.id === responseParticipaField?.id && isResponseGroupCourse && responseGroupCount > 0 && (
                          <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                            <span className="block text-xs font-bold text-white/40 uppercase tracking-wider">
                              Corsisti Partecipanti ({responseGroupCount})
                            </span>
                            
                            <div className="space-y-4">
                              {Array.from({ length: responseGroupCount }).map((_, idx) => {
                                const pIndex = idx + 1;
                                const pName = selectedResponse.answers[`participant_${pIndex}_name`] || "-";
                                const pEmail = selectedResponse.answers[`participant_${pIndex}_email`] || "";
                                const pPhone = selectedResponse.answers[`participant_${pIndex}_phone`] || "";
                                const pNotes = selectedResponse.answers[`participant_${pIndex}_notes`] || "";

                                return (
                                  <div key={pIndex} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2 text-left">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                                      <span className="text-xs font-bold text-[#A74758]">Corsista {pIndex}</span>
                                    </div>
                                    <div className="text-sm">
                                      <span className="text-white/40 text-xs block">Nome</span>
                                      <span className="font-semibold text-white">{pName}</span>
                                    </div>
                                    {(pEmail || pPhone) && (
                                      <div className="grid grid-cols-2 gap-3 text-xs">
                                        {pEmail && (
                                          <div>
                                            <span className="text-white/40 block">Email</span>
                                            <span className="text-white font-medium">{pEmail}</span>
                                          </div>
                                        )}
                                        {pPhone && (
                                          <div>
                                            <span className="text-white/40 block">Telefono</span>
                                            <span className="text-white font-medium">{pPhone}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {pNotes && (
                                      <div className="text-xs border-t border-white/5 pt-1.5 mt-1">
                                        <span className="text-white/40 block">Dati Professionali & Altro</span>
                                        <span className="text-white/80 whitespace-pre-wrap leading-relaxed">{pNotes}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm italic text-white/40">Impossibile mappare le domande (modulo eliminato).</p>
                )}
              </div>

              {/* Response Comments */}
              <ResponseComments
                responseId={selectedResponse.id}
                initialComments={selectedResponse.comments}
                currentUserName={currentUserName}
                currentUserRole={currentUserRole}
                onCommentsUpdate={(updatedComments) => {
                  setResponses((prev) =>
                    prev.map((r) =>
                      r.id === selectedResponse.id
                        ? { ...r, comments: updatedComments }
                        : r
                    )
                  );
                  setSelectedResponse((prev: any) => {
                    if (!prev) return null;
                    return { ...prev, comments: updatedComments };
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 bg-neutral-900 px-6 py-4 border-t border-white/10">
              {selectedResponse.status !== "ARCHIVED" && (
                <button
                  type="button"
                  onClick={() => {
                    handleArchiveResponse(selectedResponse.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#A74758] text-white px-4 py-2 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition shadow-sm"
                >
                  <Archive className="size-3.5" />
                  Marca come Completato
                </button>
              )}
              <Button type="button" variant="soft" onClick={() => setSelectedResponse(null)} className="bg-white/5 text-white hover:bg-white/10">
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
