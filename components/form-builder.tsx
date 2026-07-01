"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, Trash2, ArrowUp, ArrowDown, ClipboardList, Check, X, 
  GitBranch, ListChecks, Settings2, MonitorSmartphone, Eye, HelpCircle,
  AlertCircle, Smartphone, Monitor, Info, ArrowLeft, ArrowUpRight, DollarSign, Calendar,
  ChevronRight
} from "lucide-react";
import { Badge, Card, Select, Button } from "@/components/ui";
import { DynamicIcon } from "@/components/dynamic-icon";
import { cn } from "@/lib/utils";

type LocationOption = { id: string; name: string };
type UserOption = { id: string; name: string; role: string; mansione: string | null };

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

const USER_ROLES = [
  { value: "DIPENDENTE", label: "Dipendente" },
  { value: "RESPONSABILE", label: "Responsabile" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

const FORM_ICONS = [
  "ClipboardList", "FileCheck2", "CalendarDays", "Calculator", "CheckSquare", 
  "FileText", "Building2", "Smartphone", "UserRound", "Users", "Mail", 
  "Bell", "Activity", "Star", "Heart", "Smile", "Sparkles", "Coffee", 
  "ShoppingBag", "Utensils", "DollarSign", "MapPin", "Folder", "Package", "ShoppingCart"
];

export function FormBuilder({
  initialForm,
  locations,
  users,
  template = "",
}: {
  initialForm: any | null;
  locations: LocationOption[];
  users: UserOption[];
  template?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"builder" | "settings" | "preview">("builder");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form states
  const [formName, setFormName] = useState(() => {
    if (initialForm?.name) return initialForm.name;
    if (template === "talent") return "CANDIDATURA";
    if (template === "order") return "Modulo Ordine";
    return "";
  });
  const [formDesc, setFormDesc] = useState(() => {
    if (initialForm?.description) return initialForm.description;
    if (template === "talent") return "Registra una nuova candidatura o compila i dettagli di un potenziale dipendente.";
    if (template === "order") return "Raccolta e gestione ordini per clienti.";
    return "";
  });
  const [formCategory, setFormCategory] = useState(() => {
    if (initialForm?.category) return initialForm.category;
    if (template === "order") return "Ordini";
    return "Generale";
  });
  const [formActive, setFormActive] = useState(initialForm ? initialForm.active : true);
  const [formIcon, setFormIcon] = useState(() => {
    if (initialForm?.icon) return initialForm.icon;
    if (template === "talent") return "UserPlus";
    if (template === "order") return "ShoppingCart";
    return "ClipboardList";
  });
  const [allowedRoles, setAllowedRoles] = useState<string[]>(initialForm?.allowed_roles || []);
  const [allowedLocations, setAllowedLocations] = useState<string[]>(initialForm?.allowed_location_ids || []);
  const [notifyRoles, setNotifyRoles] = useState<string[]>(initialForm?.notify_roles || []);
  const [notifyUserIds, setNotifyUserIds] = useState<string[]>(initialForm?.notify_user_ids || []);

  const [formFields, setFormFields] = useState<FormField[]>(() => {
    if (initialForm?.fields) return initialForm.fields;
    if (template === "talent") {
      return [
        { id: "candidato_nome", label: "NOME E COGNOME CANDIDATO", type: "text", required: true, position: { x: 280, y: 200 } },
        { id: "candidato_email", label: "EMAIL", type: "text", required: true, position: { x: 600, y: 200 } },
        { id: "candidato_telefono", label: "TELEFONO / CELLULARE", type: "text", required: true, position: { x: 920, y: 200 } },
        { id: "candidato_nascita", label: "DATA DI NASCITA", type: "date", required: false, position: { x: 1240, y: 200 } },
        { 
          id: "candidato_ruolo", 
          label: "RUOLO DESIDERATO / PROFESSIONE", 
          type: "select", 
          required: true, 
          options: [
            "Estetista",
            "Onicotecnica",
            "Receptionist",
            "Lashemaker",
            "Apprendista Estetista",
            "Massaggiatrice",
            "Store Manager",
            "Responsabile",
            "Altro"
          ],
          position: { x: 1560, y: 200 }
        },
        { id: "candidato_cv", label: "CURRICULUM VITAE (PDF/Foto)", type: "file", required: false, position: { x: 1880, y: 200 } },
        { id: "candidato_note", label: "NOTE E COMMENTI", type: "textarea", required: false, position: { x: 2200, y: 200 } }
      ];
    }
    if (template === "order") {
      return [
        { id: "order_cliente", label: "NOME CLIENTE", type: "text", required: true, position: { x: 280, y: 200 } },
        { id: "order_trattamento", label: "TRATTAMENTO", type: "text", required: true, position: { x: 600, y: 200 } },
        { id: "order_importo", label: "IMPORTO", type: "money", required: true, position: { x: 920, y: 200 } },
        { id: "order_note", label: "NOTE AGGIUNTIVE", type: "textarea", required: false, position: { x: 1240, y: 200 } }
      ];
    }
    return [{ id: `field_${Date.now()}`, label: "Domanda 1", type: "text", required: true, position: { x: 280, y: 200 } }];
  });

  // Inspector and Visual states
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [previewFiles, setPreviewFiles] = useState<Record<string, File>>({});
  const [connectingTargetId, setConnectingTargetId] = useState<string | null>(null);
  const [activePreviewFieldIndex, setActivePreviewFieldIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);

  const visiblePreviewFields = useMemo(() => {
    return formFields.filter((field) => {
      const conditions = field.show_ifs && field.show_ifs.length > 0
        ? field.show_ifs
        : field.show_if?.field_id
          ? [field.show_if]
          : [];

      if (conditions.length === 0) return true;

      return conditions.some(cond => {
        if (!cond.field_id) return true;
        const actualValue = String(previewAnswers[cond.field_id] ?? "").toLowerCase().trim();
        const expectedValue = String(cond.value ?? "").toLowerCase().trim();
        if (!expectedValue) return Boolean(actualValue);
        if (cond.operator === "contains") return actualValue.includes(expectedValue);
        if (cond.operator === "not_equals") return actualValue !== expectedValue;
        return actualValue === expectedValue;
      });
    });
  }, [formFields, previewAnswers]);

  useEffect(() => {
    if (activeTab === "preview") {
      setActivePreviewFieldIndex(0);
      setPreviewAnswers({});
    }
  }, [activeTab]);

  const handlePreviewNext = () => {
    const currentIdx = Math.min(activePreviewFieldIndex, Math.max(0, visiblePreviewFields.length - 1));
    const field = visiblePreviewFields[currentIdx];
    if (!field) return;
    
    if (field.required) {
      const val = previewAnswers[field.id];
      if (val === undefined || val === null || String(val).trim() === "") {
        alert(`Il campo "${field.label || `Domanda ${currentIdx + 1}`}" è obbligatorio.`);
        return;
      }
    }
    
    if (activePreviewFieldIndex < visiblePreviewFields.length - 1) {
      setActivePreviewFieldIndex(activePreviewFieldIndex + 1);
    }
  };

  const canvasRef = useRef<HTMLDivElement>(null);
  const [svgLines, setSvgLines] = useState<Array<{ 
    d: string; 
    fromId: string; 
    toId: string;
    mx: number;
    my: number;
    targetFieldId: string;
    conditionIndex?: number;
  }>>([]);

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 2000, height: 2000 });

  const selectedFieldIndex = formFields.findIndex(f => f.id === selectedFieldId);
  const selectedField = selectedFieldIndex !== -1 ? formFields[selectedFieldIndex] : null;

  // Toggle roles / locations helper functions
  const toggleRole = (r: string) => {
    setAllowedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };
  const toggleLocation = (id: string) => {
    setAllowedLocations(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleNotifyRole = (r: string) => {
    setNotifyRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };
  const toggleNotifyUser = (id: string) => {
    setNotifyUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addField = () => {
    const newId = `field_${Date.now()}`;
    const newField: FormField = {
      id: newId,
      label: `Domanda ${formFields.length + 1}`,
      type: "text",
      required: true
    };
    setFormFields([...formFields, newField]);
    setSelectedFieldId(newId);
  };

  const addTemplateField = (label: string, type: FormField["type"], options?: string[]) => {
    if (!contextMenu) return;
    const newId = `field_${Date.now()}`;
    const newField: FormField = {
      id: newId,
      label,
      type,
      required: true,
      options,
      position: {
        x: Math.round(contextMenu.canvasX),
        y: Math.round(contextMenu.canvasY)
      }
    };
    setFormFields(prev => [...prev, newField]);
    setSelectedFieldId(newId);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasX = mouseX + canvasRef.current.scrollLeft;
    const canvasY = mouseY + canvasRef.current.scrollTop;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      canvasX,
      canvasY
    });
  };

  const removeField = (id: string) => {
    if (formFields.length <= 1) return;
    const updated = formFields.filter(f => f.id !== id);
    // Also clean up show_if conditions that reference this deleted field
    const cleaned = updated.map(f => {
      if (f.show_if?.field_id === id) {
        return { ...f, show_if: null };
      }
      return f;
    });
    setFormFields(cleaned);
    if (selectedFieldId === id) {
      setSelectedFieldId(cleaned[0]?.id || null);
    }
  };

  // Update fields helper
  const updateFieldProperties = (updates: Partial<FormField>) => {
    if (selectedFieldIndex === -1) return;
    setFormFields((prevFields) => {
      const updated = [...prevFields];
      updated[selectedFieldIndex] = { ...updated[selectedFieldIndex], ...updates };
      return updated;
    });
  };

  const updateFieldProperty = (key: keyof FormField, value: any) => {
    if (selectedFieldIndex === -1) return;
    setFormFields((prevFields) => {
      const updated = [...prevFields];
      updated[selectedFieldIndex] = { ...updated[selectedFieldIndex], [key]: value };
      return updated;
    });
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const updated = [...formFields];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setFormFields(updated);
  };

  const moveFieldDown = (index: number) => {
    if (index === formFields.length - 1) return;
    const updated = [...formFields];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setFormFields(updated);
  };

  const handleMouseDown = (e: React.MouseEvent, fieldId: string, index: number) => {
    // Only drag with left mouse click
    if (e.button !== 0) return;
    
    // Don't drag if clicking buttons, selects, inputs, or handles
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("textarea")) {
      return;
    }

    e.preventDefault();
    setSelectedFieldId(fieldId);

    const initialX = formFields[index].position?.x ?? (280 + index * 320);
    const initialY = formFields[index].position?.y ?? 200;

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      // Update positions
      setFormFields(prev => {
        return prev.map(f => {
          if (f.id === fieldId) {
            return {
              ...f,
              position: {
                x: Math.max(20, initialX + dx),
                y: Math.max(20, initialY + dy)
              }
            };
          }
          return f;
        });
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Connect visual nodes layout (SVG calculation)
  const calculateLines = () => {
    if (!canvasRef.current || activeTab !== "builder") return;

    const container = canvasRef.current;
    const newLines: Array<{ 
      d: string; 
      fromId: string; 
      toId: string;
      mx: number;
      my: number;
      targetFieldId: string;
      conditionIndex?: number;
    }> = [];

    // Helper to get coordinates relative to the canvas viewport container
    const getRelativeCoords = (element: HTMLElement, containerEl: HTMLElement) => {
      let x = 0;
      let y = 0;
      let el: HTMLElement | null = element;
      while (el && el !== containerEl) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      return { x, y };
    };

    // 1. Connection from Start node to Q1
    const startEl = document.getElementById("node-start");
    const firstField = formFields[0];
    if (startEl && firstField) {
      const firstEl = document.getElementById(`node-${firstField.id}`);
      if (firstEl) {
        const startCoords = getRelativeCoords(startEl, container);
        const firstCoords = getRelativeCoords(firstEl, container);
        const x1 = startCoords.x + startEl.offsetWidth;
        const y1 = startCoords.y + (startEl.offsetHeight / 2);
        const x2 = firstCoords.x;
        const y2 = firstCoords.y + (firstEl.offsetHeight / 2);
        const controlOffset = Math.max(Math.abs(x2 - x1) * 0.5, 40);
        const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
        
        newLines.push({ 
          d, 
          fromId: "start", 
          toId: firstField.id, 
          mx: (x1 + x2) / 2, 
          my: (y1 + y2) / 2, 
          targetFieldId: "" 
        });
      }
    }

    // 2. Connection between sequential nodes and merge paths
    for (let i = 1; i < formFields.length; i++) {
      const currField = formFields[i];
      const hasCondition = currField.show_if || (currField.show_ifs && currField.show_ifs.length > 0);
      if (!hasCondition) {
        // Draw lines from preceding questions that merge into this always-visible question
        // We look at the immediate predecessor, and scan backwards through consecutive conditional questions
        let k = i - 1;
        while (k >= 0) {
          const sourceField = formFields[k];
          const sourceHasCondition = sourceField.show_if || (sourceField.show_ifs && sourceField.show_ifs.length > 0);
          
          // We only draw the line from the non-conditional field if it is the immediate predecessor (k === i - 1)
          const isImmediate = k === i - 1;
          const shouldDraw = sourceHasCondition || isImmediate;
          
          if (shouldDraw) {
            const sourceEl = document.getElementById(`node-${sourceField.id}`);
            const currEl = document.getElementById(`node-${currField.id}`);
            if (sourceEl && currEl) {
              const sourceCoords = getRelativeCoords(sourceEl, container);
              const currCoords = getRelativeCoords(currEl, container);
              const x1 = sourceCoords.x + sourceEl.offsetWidth;
              const y1 = sourceCoords.y + (sourceEl.offsetHeight / 2);
              const x2 = currCoords.x;
              const y2 = currCoords.y + (currEl.offsetHeight / 2);
              const controlOffset = Math.max(Math.abs(x2 - x1) * 0.5, 40);
              const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
              
              const exists = newLines.some(l => l.fromId === sourceField.id && l.toId === currField.id);
              if (!exists) {
                newLines.push({ 
                  d, 
                  fromId: sourceField.id, 
                  toId: currField.id, 
                  mx: (x1 + x2) / 2, 
                  my: (y1 + y2) / 2, 
                  targetFieldId: "" 
                });
              }
            }
          }
          
          // If the source question is NOT conditional, we stop scanning backwards
          if (!sourceHasCondition) {
            break;
          }
          k--;
        }
      }
    }

    // 3. Connection for custom conditional lines (show_ifs / show_if)
    formFields.forEach((field) => {
      const conditions = field.show_ifs && field.show_ifs.length > 0 
        ? field.show_ifs 
        : field.show_if?.field_id 
          ? [field.show_if] 
          : [];

      conditions.forEach((cond, condIdx) => {
        if (!cond.field_id) return;
        const sourceEl = document.getElementById(`node-${cond.field_id}`);
        const targetEl = document.getElementById(`node-${field.id}`);

        if (sourceEl && targetEl) {
          const sourceCoords = getRelativeCoords(sourceEl, container);
          const targetCoords = getRelativeCoords(targetEl, container);

          // Connect from right center of source node to left center of target node
          const x1 = sourceCoords.x + sourceEl.offsetWidth;
          const y1 = sourceCoords.y + (sourceEl.offsetHeight / 2);

          const x2 = targetCoords.x;
          const y2 = targetCoords.y + (targetEl.offsetHeight / 2);

          // Draw a smooth bezier curve
          const controlOffset = Math.max(Math.abs(x2 - x1) * 0.5, 40);
          const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

          // Midpoint of curve
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;

          newLines.push({ 
            d, 
            fromId: cond.field_id, 
            toId: field.id, 
            mx, 
            my, 
            targetFieldId: field.id,
            conditionIndex: condIdx
          });
        }
      });
    });

    setSvgLines(newLines);

    // Calculate required SVG canvas size based on node positions to cover the entire scrollable area
    let maxX = 2000;
    let maxY = 2000;
    formFields.forEach((field, index) => {
      const posX = field.position?.x ?? (280 + index * 320);
      const posY = field.position?.y ?? 220;
      if (posX + 600 > maxX) maxX = posX + 600;
      if (posY + 400 > maxY) maxY = posY + 400;
    });
    setCanvasDimensions({ width: maxX, height: maxY });
  };

  useLayoutEffect(() => {
    if (activeTab === "builder") {
      calculateLines();
      
      // Listen to window resizing or changes
      window.addEventListener("resize", calculateLines);
      
      // Run recalculation after a short delay to account for layouts settling
      const timer = setTimeout(calculateLines, 100);

      return () => {
        window.removeEventListener("resize", calculateLines);
        clearTimeout(timer);
      };
    }
  }, [formFields, activeTab, selectedFieldId]);

  // Handle Save
  const handleSave = async () => {
    if (!formName.trim()) {
      setErrorMsg("Il nome del modulo è obbligatorio.");
      setActiveTab("settings");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const payload = {
      name: formName.trim(),
      description: formDesc.trim(),
      category: formCategory.trim(),
      active: formActive,
      icon: formIcon,
      allowed_roles: allowedRoles.length > 0 ? allowedRoles : null,
      allowed_location_ids: allowedLocations.length > 0 ? allowedLocations : null,
      notify_roles: notifyRoles.length > 0 ? notifyRoles : null,
      notify_user_ids: notifyUserIds.length > 0 ? notifyUserIds : null,
      fields: formFields,
    };

    try {
      const url = initialForm ? `/api/service-forms/${initialForm.id}` : "/api/service-forms";
      const method = initialForm ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore durante il salvataggio.");
      }

      router.push("/settings/forms?tab=templates");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Qualcosa è andato storto. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  // Preview form logical validation
  const isFieldVisibleInPreview = (field: FormField) => {
    const conditions = field.show_ifs && field.show_ifs.length > 0
      ? field.show_ifs
      : field.show_if?.field_id
        ? [field.show_if]
        : [];

    if (conditions.length === 0) return true;

    return conditions.some(cond => {
      if (!cond.field_id) return true;
      const actualValue = String(previewAnswers[cond.field_id] ?? "").toLowerCase().trim();
      const expectedValue = String(cond.value ?? "").toLowerCase().trim();
      if (!expectedValue) return Boolean(actualValue);
      if (cond.operator === "contains") return actualValue.includes(expectedValue);
      if (cond.operator === "not_equals") return actualValue !== expectedValue;
      return actualValue === expectedValue;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
      {/* Sub-header navigation bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-black/5 bg-[#FBF7F9] p-4 rounded-2xl mb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/settings/forms?tab=templates")}
            className="grid size-10 place-items-center rounded-xl bg-white border border-black/5 text-black/50 hover:bg-black/5 hover:text-black transition"
            title="Torna alla gestione moduli"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold truncate max-w-[200px] sm:max-w-xs">{formName || "Nuovo Modulo"}</h2>
            <p className="text-xs text-black/40 font-medium">Categoria: <span className="font-semibold">{formCategory || "Generale"}</span></p>
          </div>
        </div>

        {/* Tab triggers */}
        <div className="flex items-center justify-center p-1 bg-black/5 rounded-xl self-center sm:self-auto">
          <button
            onClick={() => setActiveTab("builder")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "builder" ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black"
            )}
          >
            <GitBranch className="size-3.5" />
            Console Flusso
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "settings" ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black"
            )}
          >
            <Settings2 className="size-3.5" />
            Impostazioni
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "preview" ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black"
            )}
          >
            <MonitorSmartphone className="size-3.5" />
            Anteprima
          </button>
        </div>

        {/* Action button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#A74758] px-5 py-2 text-xs font-bold text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva Modulo"}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 text-red-700 border border-red-100 p-3 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main workspace panels */}
      <div className="flex-1 rounded-[24px] border border-black/5 bg-white shadow-sm overflow-hidden min-h-0">
        
        {/* TAB 1: VISUAL NODES BUILDER */}
        {activeTab === "builder" && (
          <div className="flex h-full min-h-0 divide-x divide-black/5">
            {/* Visual Canvas Area (Left) */}
            <div 
              ref={canvasRef}
              onContextMenu={handleContextMenu}
              onClick={(e) => {
                // Only deselect if clicking directly on the canvas background
                if (e.target === canvasRef.current || (e.target as HTMLElement).id === "canvas-grid") {
                  setSelectedFieldId(null);
                }
              }}
              id="canvas-grid"
              className="flex-1 overflow-auto bg-[#111017] p-8 relative min-w-0"
              style={{
                backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)",
                backgroundSize: "24px 24px"
              }}
            >
              {/* Context Menu Tutorial Hint */}
              <div className="absolute top-4 right-4 z-10 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white/50 flex items-center gap-1.5 pointer-events-none select-none">
                <Info className="size-3.5 text-[#A74758]" />
                <span>Tasto destro per inserimento rapido</span>
              </div>

              {/* Connection Mode Instruction Banner */}
              {connectingTargetId && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 border border-[#A74758] rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="size-2 rounded-full bg-[#A74758] animate-ping" />
                  <span className="text-xs font-bold text-white">
                    Seleziona la domanda d'origine per collegare Q{formFields.findIndex(f => f.id === connectingTargetId) + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConnectingTargetId(null)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
                  >
                    Annulla
                  </button>
                </div>
              )}

              {/* Connection overlay lines */}
              <svg 
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  width: `${canvasDimensions.width}px`,
                  height: `${canvasDimensions.height}px`,
                }}
              >
                <defs>
                  <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF1493" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#FF69B4" stopOpacity="1.0" />
                    <stop offset="100%" stopColor="#FF1493" stopOpacity="0.8" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                {svgLines.map((line, idx) => {
                  const isConditional = line.targetFieldId !== "";
                  return (
                    <React.Fragment key={idx}>
                      {/* Black shadow path under line to make it clearly visible */}
                      <path
                        d={line.d}
                        fill="none"
                        stroke="#000000"
                        strokeWidth="7.5"
                        strokeOpacity="0.65"
                      />
                      {isConditional ? (
                        <path
                          d={line.d}
                          fill="none"
                          stroke="url(#glow-grad)"
                          strokeWidth="5"
                          filter="url(#glow)"
                          strokeDasharray="4 2"
                          className="animate-[dash_30s_linear_infinite]"
                          style={{
                            strokeDashoffset: 100,
                          }}
                        />
                      ) : (
                        <path
                          d={line.d}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.35)"
                          strokeWidth="2.5"
                          strokeDasharray="5 5"
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </svg>

              {/* Disconnect buttons overlay */}
              {!connectingTargetId && svgLines.map((line, idx) => {
                if (!line.targetFieldId) return null;
                return (
                  <button
                    key={`del-btn-${idx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const updatedFields = formFields.map(f => {
                        if (f.id === line.targetFieldId) {
                          const currentShowIfs = f.show_ifs || (f.show_if ? [f.show_if] : []);
                          const updatedShowIfs = currentShowIfs.filter((_, condIdx) => condIdx !== line.conditionIndex);
                          return {
                            ...f,
                            show_if: updatedShowIfs[0] || null,
                            show_ifs: updatedShowIfs
                          };
                        }
                        return f;
                      });
                      setFormFields(updatedFields);
                    }}
                    className="absolute z-30 size-6 rounded-full bg-red-600 border border-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                    style={{
                      left: line.mx - 12,
                      top: line.my - 12,
                    }}
                    title="Rimuovi collegamento logico"
                  >
                    <X className="size-3.5" />
                  </button>
                );
              })}

              <style jsx global>{`
                @keyframes dash {
                  to {
                    stroke-dashoffset: 0;
                  }
                }
              `}</style>

              {/* Start node */}
              <div 
                id="node-start"
                className="absolute rounded-[20px] bg-white/5 border border-white/10 p-3 text-center text-white/50 text-xs font-bold tracking-wider uppercase select-none w-48"
                style={{
                  left: "40px",
                  top: "220px",
                }}
              >
                Avvio Formulario
              </div>

              {/* Nodes */}
              {formFields.map((field, index) => {
                const isSelected = field.id === selectedFieldId;
                const isConditional = Boolean(field.show_if?.field_id) || (field.show_ifs && field.show_ifs.length > 0);
                const sourceIndex = formFields.findIndex(f => f.id === field.show_if?.field_id);

                // Connection logic derived variables
                const isConnectingMode = connectingTargetId !== null;
                const targetIndex = isConnectingMode ? formFields.findIndex(f => f.id === connectingTargetId) : -1;
                const isValidSource = isConnectingMode && index < targetIndex;
                const isSelfOrAfterTarget = isConnectingMode && index >= targetIndex;

                const posX = field.position?.x ?? (280 + index * 320);
                const posY = field.position?.y ?? 220;

                return (
                  <div 
                    key={field.id} 
                    id={`node-${field.id}`}
                    onMouseDown={(e) => handleMouseDown(e, field.id, index)}
                    className="absolute cursor-grab active:cursor-grabbing transition-shadow duration-150"
                    style={{
                      left: `${posX}px`,
                      top: `${posY}px`,
                      zIndex: isSelected ? 30 : 10,
                    }}
                  >
                    <div className="flex items-center relative group/node">
                      {/* LEFT INPUT CONNECTOR HANDLE (index > 0) */}
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConnectingTargetId(field.id);
                          }}
                          className={cn(
                            "absolute -left-3 top-1/2 -translate-y-1/2 size-6 rounded-full border bg-neutral-950 flex items-center justify-center cursor-pointer transition-all z-20 hover:scale-110 shadow-lg",
                            isConditional 
                              ? "border-[#FF1493] text-[#FF1493] hover:border-red-500 hover:text-red-500" 
                              : "border-white/20 text-white/30 hover:border-white/60 hover:text-white"
                          )}
                          title={isConditional ? "Modifica / Scollega logica" : "Collega a una domanda precedente"}
                        >
                          <div className={cn("size-2.5 rounded-full transition-colors", isConditional ? "bg-[#FF1493] animate-pulse" : "bg-white/20")} />
                        </button>
                      )}

                      {/* RIGHT OUTPUT CONNECTOR HANDLE */}
                      <div 
                        className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full border border-white/20 bg-neutral-950 flex items-center justify-center z-20 shadow-lg pointer-events-none"
                        title="Origine per condizioni successive"
                      >
                        <div className="size-2.5 rounded-full bg-white/40" />
                      </div>

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isConnectingMode) {
                            if (isValidSource) {
                              const updatedFields = formFields.map(f => {
                                if (f.id === connectingTargetId) {
                                  const newCond = {
                                    field_id: field.id,
                                    operator: "equals" as const,
                                    value: field.options?.[0] || ""
                                  };
                                  const currentShowIfs = f.show_ifs || (f.show_if ? [f.show_if] : []);
                                  const alreadyExists = currentShowIfs.some(c => c.field_id === field.id);
                                  const updatedShowIfs = alreadyExists 
                                    ? currentShowIfs 
                                    : [...currentShowIfs, newCond];
                                  
                                  return {
                                    ...f,
                                    show_if: updatedShowIfs[0] || null,
                                    show_ifs: updatedShowIfs
                                  };
                                }
                                return f;
                              });
                              setFormFields(updatedFields);
                              setSelectedFieldId(connectingTargetId);
                              setConnectingTargetId(null);
                            }
                          } else {
                            setSelectedFieldId(field.id);
                          }
                        }}
                        className={cn(
                          "w-64 rounded-[24px] border p-4 shadow-xl text-white cursor-pointer select-none transition-all duration-300 relative",
                          isSelected 
                            ? "bg-slate-900 border-[#FF1493] shadow-[#FF1493]/15 ring-2 ring-[#FF1493]/35 scale-[1.03]" 
                            : isConditional 
                              ? "bg-[#1E1A22] border-[#FF1493]/40 hover:border-[#FF1493]/70"
                              : "bg-[#1B1A20] border-white/10 hover:border-white/30",
                          isValidSource && "border-emerald-500/60 bg-[#12221A] ring-2 ring-emerald-500/20 hover:scale-[1.03] hover:border-emerald-400",
                          isSelfOrAfterTarget && "opacity-30 pointer-events-none"
                        )}
                      >
                        {/* Connection Help Overlay */}
                        {isValidSource && (
                          <div className="absolute inset-0 bg-emerald-950/20 rounded-[24px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40 z-10">
                            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 bg-neutral-900/90 px-3 py-1.5 rounded-xl border border-emerald-500/30 shadow-md animate-bounce">
                              Imposta origine
                            </span>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[9px] font-black text-white/70">
                            Q{index + 1}
                          </span>
                          <span className={cn(
                            "rounded-lg px-2 py-0.5 text-[9px] font-bold",
                            isConditional ? "bg-[#A74758]/20 text-[#ff8bb2]" : "bg-white/10 text-white/40"
                          )}>
                            {isConditional ? `Da Q${sourceIndex + 1}` : "Sempre visibile"}
                          </span>
                        </div>

                        <h4 className="mt-3 text-sm font-extrabold leading-tight line-clamp-2 min-h-[36px] text-white">
                          {field.label || `Domanda ${index + 1}`}
                        </h4>

                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[10px] font-bold text-white/45">
                          <span className="uppercase">{field.type}</span>
                          <span>{field.required ? "Obbligatoria" : "Facoltativa"}</span>
                        </div>

                        {/* Node action buttons inside canvas */}
                        <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-white/5 pt-3">
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConnectingTargetId(field.id);
                              }}
                              className={cn(
                                "mr-auto px-2 py-0.5 rounded-lg text-[9px] font-bold transition flex items-center gap-1 shrink-0",
                                isConditional 
                                  ? "bg-[#FF1493]/20 text-[#FF1493] border border-[#FF1493]/35" 
                                  : "bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white"
                              )}
                              title={isConditional ? "Modifica Logica" : "Collega a un'altra domanda"}
                            >
                              <GitBranch className="size-3" />
                              {isConditional ? "Logica" : "Collega"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                moveFieldUp(index);
                            }}
                            disabled={index === 0}
                            className="p-1 text-white/40 hover:text-white disabled:opacity-20 transition"
                            title="Sposta prima (nella sequenza)"
                          >
                            <ArrowUp className="-rotate-90 size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                moveFieldDown(index);
                            }}
                            disabled={index === formFields.length - 1}
                            className="p-1 text-white/40 hover:text-white disabled:opacity-20 transition"
                            title="Sposta dopo (nella sequenza)"
                          >
                            <ArrowDown className="-rotate-90 size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                            disabled={formFields.length <= 1}
                            className="p-1 text-red-400 hover:text-red-300 disabled:opacity-20 transition ml-2"
                            title="Elimina domanda"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quick actions bar */}
              <div 
                className="absolute flex gap-3 animate-in fade-in duration-300"
                style={{
                  left: `${280 + formFields.length * 320}px`,
                  top: "270px"
                }}
              >
                <button
                  type="button"
                  onClick={addField}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-paradise-softPink border border-paradise-pink/25 px-6 text-xs font-bold text-[#A74758] transition hover:scale-[1.02] shadow-lg"
                >
                  <Plus className="size-4 text-[#A74758]" />
                  Aggiungi Domanda
                </button>
              </div>
              {/* Context menu overlay */}
              {contextMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-[100]" 
                    onClick={() => setContextMenu(null)} 
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu(null);
                    }}
                  />
                  <div 
                    className="fixed z-[101] w-60 rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl py-2 text-xs font-semibold text-white/95 animate-in fade-in zoom-in-95 duration-100"
                    style={{
                      top: `${contextMenu.y}px`,
                      left: `${contextMenu.x}px`
                    }}
                  >
                    <div className="px-3.5 py-1.5 text-[9px] font-bold text-[#F4A3C4] uppercase tracking-wider border-b border-white/5 mb-1.5">
                      Inserimento Rapido
                    </div>
                    
                    {/* Anagrafica */}
                    <div className="px-3 py-1 text-[9px] text-white/30 font-bold uppercase tracking-wider">Anagrafica</div>
                    <button
                      type="button"
                      onClick={() => addTemplateField("Nome Cliente", "text")}
                      className="w-full text-left px-4 py-2 hover:bg-[#A74758]/20 hover:text-white transition flex items-center gap-2"
                    >
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Nome Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => addTemplateField("Cognome", "text")}
                      className="w-full text-left px-4 py-2 hover:bg-[#A74758]/20 hover:text-white transition flex items-center gap-2"
                    >
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Cognome
                    </button>

                    {/* Contatti */}
                    <div className="px-3 py-1 text-[9px] text-white/30 font-bold uppercase tracking-wider mt-1.5">Contatti</div>
                    <button
                      type="button"
                      onClick={() => addTemplateField("Telefono", "text")}
                      className="w-full text-left px-4 py-2 hover:bg-[#A74758]/20 hover:text-white transition flex items-center gap-2"
                    >
                      <span className="size-1.5 rounded-full bg-sky-500" />
                      Numero Telefono
                    </button>
                    <button
                      type="button"
                      onClick={() => addTemplateField("Email", "text")}
                      className="w-full text-left px-4 py-2 hover:bg-[#A74758]/20 hover:text-white transition flex items-center gap-2"
                    >
                      <span className="size-1.5 rounded-full bg-sky-500" />
                      Indirizzo Email
                    </button>

                    {/* Scelte e Tipi */}
                    <div className="px-3 py-1 text-[9px] text-white/30 font-bold uppercase tracking-wider mt-1.5">Scelta</div>
                    <button
                      type="button"
                      onClick={() => addTemplateField("Opzione", "select", ["Sì", "No"])}
                      className="w-full text-left px-4 py-2 hover:bg-[#A74758]/20 hover:text-white transition flex items-center gap-2"
                    >
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      Scelta Singola (Sì/No)
                    </button>

                    {/* Generici */}
                    <div className="px-3 py-1 text-[9px] text-white/30 font-bold uppercase tracking-wider mt-1.5">Altri Campi</div>
                    <div className="grid grid-cols-2 gap-0.5 px-2 pb-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => addTemplateField("Testo Breve", "text")}
                        className="text-left px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white transition"
                      >
                        Testo Breve
                      </button>
                      <button
                        type="button"
                        onClick={() => addTemplateField("Testo Lungo", "textarea")}
                        className="text-left px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white transition"
                      >
                        Testo Lungo
                      </button>
                      <button
                        type="button"
                        onClick={() => addTemplateField("Importo (€)", "money")}
                        className="text-left px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white transition"
                      >
                        Importo (€)
                      </button>
                      <button
                        type="button"
                        onClick={() => addTemplateField("Data", "date")}
                        className="text-left px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white transition"
                      >
                        Data
                      </button>
                      <button
                        type="button"
                        onClick={() => addTemplateField("Collaboratore", "worker")}
                        className="text-left px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white transition"
                      >
                        Collaboratore
                      </button>
                      <button
                        type="button"
                        onClick={() => addTemplateField("File", "file")}
                        className="text-left px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white transition"
                      >
                        File/Allegato
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Question Inspector Panel (Right) */}
            {selectedFieldId && selectedField && (
              <div className="w-80 overflow-y-auto bg-white p-5 shrink-0 flex flex-col justify-between border-l border-black/5 animate-in slide-in-from-right duration-200">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-black/5">
                    <div>
                      <p className="text-[10px] font-bold text-black/35 uppercase tracking-wider">Proprietà Domanda</p>
                      <h4 className="text-sm font-bold text-black">Domanda Q{selectedFieldIndex + 1}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="dark">{selectedField.id.slice(0, 8)}</Badge>
                      <button
                        type="button"
                        onClick={() => setSelectedFieldId(null)}
                        className="p-1 rounded-lg text-black/40 hover:text-black hover:bg-black/5 transition"
                        title="Chiudi pannello"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Text Label */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Testo Domanda *</label>
                    <input
                      type="text"
                      required
                      value={selectedField.label}
                      onChange={(e) => updateFieldProperty("label", e.target.value)}
                      placeholder="Es. Inserisci il codice ordine"
                      className="mt-1.5 h-9 w-full rounded-xl border border-black/10 px-3 text-xs outline-none focus:border-[#A74758]"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Sottotitolo / Descrizione</label>
                    <input
                      type="text"
                      value={selectedField.description || ""}
                      onChange={(e) => updateFieldProperty("description", e.target.value)}
                      placeholder="Istruzioni per la compilazione..."
                      className="mt-1.5 h-9 w-full rounded-xl border border-black/10 px-3 text-xs outline-none focus:border-[#A74758]"
                    />
                  </div>

                  {/* Response Type */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Tipo Risposta</label>
                    <Select
                      value={selectedField.type}
                      onChange={(e) => {
                        const newType = e.target.value as any;
                        if (selectedFieldIndex === -1) return;
                        setFormFields((prevFields) => {
                          const updated = [...prevFields];
                          updated[selectedFieldIndex] = {
                            ...updated[selectedFieldIndex],
                            type: newType,
                            options: newType === "select" ? ["Sì", "No"] : undefined,
                          };
                          return updated;
                        });
                      }}
                      className="mt-1.5 h-9 w-full rounded-xl border border-black/10 px-2 text-xs"
                    >
                      <option value="text">Testo Breve</option>
                      <option value="textarea">Testo Lungo</option>
                      <option value="number">Numero</option>
                      <option value="select">Opzioni Scelta Singola</option>
                      <option value="money">Importo (€)</option>
                      <option value="date">Data</option>
                      <option value="worker">Collaboratore</option>
                      <option value="worker_multi">Collaboratori multipli</option>
                      <option value="checkbox">Check / fatto</option>
                      <option value="pin">PIN Firma</option>
                      <option value="file">File (PDF/Foto)</option>
                    </Select>
                  </div>

                  {/* Select Options */}
                  {selectedField.type === "select" && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Opzioni a Scelta</label>
                      <div className="space-y-2">
                        {(selectedField.options || []).map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOpts = [...(selectedField.options || [])];
                                newOpts[optIdx] = e.target.value;
                                updateFieldProperty("options", newOpts);
                              }}
                              placeholder={`Opzione ${optIdx + 1}`}
                              className="h-9 flex-1 rounded-lg border border-black/10 px-2.5 text-xs outline-none focus:border-[#A74758]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = (selectedField.options || []).filter((_, idx) => idx !== optIdx);
                                updateFieldProperty("options", newOpts);
                              }}
                              className="p-2 text-black/40 hover:text-[#A74758] hover:bg-black/5 rounded-lg transition animate-in fade-in duration-200"
                              title="Rimuovi opzione"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = [...(selectedField.options || []), ""];
                          updateFieldProperty("options", newOpts);
                        }}
                        className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/10 hover:border-[#A74758]/55 bg-black/5 hover:bg-[#A74758]/5 py-2 text-xs font-semibold text-[#A74758] transition active:scale-[0.98]"
                      >
                        <Plus className="size-3.5" /> Aggiungi Opzione
                      </button>
                    </div>
                  )}

                  {/* Required Checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id={`inspect-req-${selectedField.id}`}
                      type="checkbox"
                      checked={selectedField.required}
                      onChange={(e) => updateFieldProperty("required", e.target.checked)}
                      className="size-4 rounded border-black/10 text-[#A74758] focus:ring-[#A74758]"
                    />
                    <label htmlFor={`inspect-req-${selectedField.id}`} className="text-xs font-semibold cursor-pointer text-black/80">
                      Risposta Obbligatoria
                    </label>
                  </div>

                  {/* Conditional Logic (show_if & show_ifs) */}
                  <div className="border-t border-black/5 pt-4 mt-2">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">Visibilità Condizionale</h5>
                    
                    {selectedFieldIndex === 0 ? (
                      <p className="text-[11px] text-black/35 leading-relaxed bg-black/5 p-2.5 rounded-xl border border-black/5">
                        La prima domanda (Q1) deve essere sempre visibile allo staff.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const currentShowIfs = selectedField.show_ifs || (selectedField.show_if ? [selectedField.show_if] : []);
                          const hasConditions = currentShowIfs.length > 0;

                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <input
                                    id="cond-toggle"
                                    type="checkbox"
                                    checked={hasConditions}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const prevField = formFields[selectedFieldIndex - 1];
                                        const defaultCond = {
                                          field_id: prevField.id,
                                          operator: "equals" as const,
                                          value: ""
                                        };
                                        updateFieldProperties({
                                          show_if: defaultCond,
                                          show_ifs: [defaultCond]
                                        });
                                      } else {
                                        updateFieldProperties({
                                          show_if: null,
                                          show_ifs: []
                                        });
                                      }
                                    }}
                                    className="size-4 rounded border-black/10 text-[#FF1493] focus:ring-[#FF1493]"
                                  />
                                  <label htmlFor="cond-toggle" className="text-xs font-semibold cursor-pointer text-black/80">
                                    Attiva logica
                                  </label>
                                </div>

                                {hasConditions && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const prevField = formFields[selectedFieldIndex - 1];
                                      const newCond = {
                                        field_id: prevField.id,
                                        operator: "equals" as const,
                                        value: ""
                                      };
                                      const updatedList = [...currentShowIfs, newCond];
                                      updateFieldProperties({
                                        show_if: updatedList[0],
                                        show_ifs: updatedList
                                      });
                                    }}
                                    className="text-[10px] font-bold text-[#FF1493] hover:text-[#FF1493]/80 flex items-center gap-1 transition"
                                  >
                                    + Aggiungi
                                  </button>
                                )}
                              </div>

                              {hasConditions && (
                                <div className="space-y-4">
                                  {currentShowIfs.map((cond, condIdx) => {
                                    const sourceField = formFields.find(f => f.id === cond.field_id);
                                    return (
                                      <div key={condIdx} className="space-y-3 bg-[#FBF7F9] p-3 rounded-2xl border border-[#FF1493]/15 relative">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedList = currentShowIfs.filter((_, idx) => idx !== condIdx);
                                            updateFieldProperties({
                                              show_if: updatedList[0] || null,
                                              show_ifs: updatedList
                                            });
                                          }}
                                          className="absolute top-2 right-2 text-black/35 hover:text-red-500 transition"
                                          title="Rimuovi condizione"
                                        >
                                          <X className="size-3.5" />
                                        </button>

                                        {/* Source Question Select */}
                                        <div className="pr-4">
                                          <label className="text-[9px] font-bold uppercase text-black/45 block mb-1">Mostra se risponde a</label>
                                          <Select
                                            value={cond.field_id}
                                            onChange={(e) => {
                                              const updatedList = currentShowIfs.map((c, idx) => {
                                                if (idx === condIdx) {
                                                  return { ...c, field_id: e.target.value, value: "" };
                                                }
                                                return c;
                                              });
                                              updateFieldProperties({
                                                show_if: updatedList[0],
                                                show_ifs: updatedList
                                              });
                                            }}
                                            className="h-8 w-full rounded-lg border border-black/10 px-2 text-[11px]"
                                          >
                                            {formFields.slice(0, selectedFieldIndex).map((f, i) => (
                                              <option key={f.id} value={f.id}>Q{i + 1} - {f.label}</option>
                                            ))}
                                          </Select>
                                        </div>

                                        {/* Operator */}
                                        <div>
                                          <label className="text-[9px] font-bold uppercase text-black/45 block mb-1">Logica</label>
                                          <Select
                                            value={cond.operator}
                                            onChange={(e) => {
                                              const updatedList = currentShowIfs.map((c, idx) => {
                                                if (idx === condIdx) {
                                                  return { ...c, operator: e.target.value as any };
                                                }
                                                return c;
                                              });
                                              updateFieldProperties({
                                                show_if: updatedList[0],
                                                show_ifs: updatedList
                                              });
                                            }}
                                            className="h-8 w-full rounded-lg border border-black/10 px-2 text-[11px]"
                                          >
                                            <option value="equals">è uguale a</option>
                                            <option value="not_equals">è diverso da</option>
                                            <option value="contains">contiene</option>
                                          </Select>
                                        </div>

                                        {/* Expected Value */}
                                        <div>
                                          <label className="text-[9px] font-bold uppercase text-black/45 block mb-1">Valore della risposta</label>
                                          {(() => {
                                            if (sourceField?.type === "select" && sourceField.options?.length) {
                                              return (
                                                <Select
                                                  value={cond.value}
                                                  onChange={(e) => {
                                                    const updatedList = currentShowIfs.map((c, idx) => {
                                                      if (idx === condIdx) {
                                                        return { ...c, value: e.target.value };
                                                      }
                                                      return c;
                                                    });
                                                    updateFieldProperties({
                                                      show_if: updatedList[0],
                                                      show_ifs: updatedList
                                                    });
                                                  }}
                                                  className="h-8 w-full rounded-lg border border-black/10 px-2 text-[11px]"
                                                >
                                                  <option value="">Qualsiasi opzione</option>
                                                  {sourceField.options.map(o => (
                                                    <option key={o} value={o}>{o}</option>
                                                  ))}
                                                </Select>
                                              );
                                            }
                                            return (
                                              <input
                                                type="text"
                                                value={cond.value}
                                                onChange={(e) => {
                                                  const updatedList = currentShowIfs.map((c, idx) => {
                                                    if (idx === condIdx) {
                                                      return { ...c, value: e.target.value };
                                                    }
                                                    return c;
                                                  });
                                                  updateFieldProperties({
                                                    show_if: updatedList[0],
                                                    show_ifs: updatedList
                                                  });
                                                }}
                                                placeholder="Lascia vuoto per qualsiasi valore"
                                                className="h-8 w-full rounded-lg border border-black/10 px-2 text-[11px] outline-none focus:border-[#FF1493]"
                                              />
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              {/* Bottom stats summary */}
              <div className="border-t border-black/5 pt-4 mt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-black/50">
                  <span>Totale domande:</span>
                  <span className="font-bold text-black">{formFields.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-black/50 mt-1">
                  <span>Collegamenti attivi:</span>
                  <span className="font-bold text-[#A74758]">{formFields.filter(f => f.show_if).length}</span>
                </div>
              </div>
            </div>
          )}
          </div>
        )}

        {/* TAB 2: GENERAL SETTINGS */}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-black border-b border-black/5 pb-3">Impostazioni Generali</h3>
            
            <div className="grid gap-5 md:grid-cols-2">
              {/* Form Name */}
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-black/50">Nome Modulo *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Es. Modulo Richiesta Materiale"
                  className="mt-1.5 h-11 w-full rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-[#A74758]"
                />
              </div>

              {/* Form Description */}
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-black/50">Descrizione scopo modulo</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Scrivi qui a cosa serve questo modulo e chi deve compilarlo..."
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-black/10 p-3.5 text-sm outline-none focus:border-[#A74758] resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Categoria Modulo</label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Es. Ordini, Operativo, Amministrazione"
                  className="mt-1.5 h-11 w-full rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-[#A74758]"
                />
                {formCategory.toLowerCase() === "ordini" && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 p-3 text-xs leading-relaxed">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <span>
                      <b>Collegamento Ordini Attivo:</b> Le risposte compilate per questo modulo verranno visualizzate come card tracciabili nella dashboard **Ordini** (`/orders`).
                    </span>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 md:mt-8">
                <input
                  id="form-active-toggle"
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="size-5 rounded-lg border-black/10 text-[#A74758] focus:ring-[#A74758]"
                />
                <label htmlFor="form-active-toggle" className="text-sm font-semibold cursor-pointer text-black">
                  Modulo Attivo (Visibile allo staff)
                </label>
              </div>
            </div>

            {/* Icon selection */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block mb-2">Icona del Modulo</label>
              <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-10 max-h-36 overflow-y-auto p-3 border border-black/5 bg-[#FBF7F9] rounded-2xl">
                {FORM_ICONS.map((iconName) => {
                  const selected = formIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormIcon(iconName)}
                      className={cn(
                        "grid aspect-square place-items-center rounded-xl border p-2 transition hover:scale-105 active:scale-95",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758] shadow-sm font-bold" 
                          : "bg-white border-black/5 text-black/60 hover:bg-black/5"
                      )}
                      title={iconName}
                    >
                      <DynamicIcon name={iconName} className="size-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Allowed Roles */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Chi può compilarlo? (Ruoli)</label>
              <p className="text-xs text-black/40 mb-3">Se non ne selezioni nessuno, tutti i membri dello staff lo vedranno.</p>
              <div className="flex flex-wrap gap-2.5">
                {USER_ROLES.map((role) => {
                  const selected = allowedRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => toggleRole(role.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                          : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                      )}
                    >
                      {selected && <Check className="size-3" />}
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Allowed Locations */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">In quali saloni è disponibile?</label>
              <p className="text-xs text-black/40 mb-3">Se non ne selezioni nessuno, sarà visibile in tutte le sedi.</p>
              <div className="flex flex-wrap gap-2.5">
                {locations.map((loc) => {
                  const selected = allowedLocations.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => toggleLocation(loc.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                          : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                      )}
                    >
                      {selected && <Check className="size-3" />}
                      {loc.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notified Roles */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Chi riceve notifiche all'invio? (Ruoli)</label>
              <p className="text-xs text-black/40 mb-3">Verranno inviate notifiche push/in-app ai membri del personale con questi ruoli.</p>
              <div className="flex flex-wrap gap-2.5">
                {USER_ROLES.map((role) => {
                  const selected = notifyRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => toggleNotifyRole(role.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                          : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                      )}
                    >
                      {selected && <Check className="size-3" />}
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notified Specific Users */}
            <div className="border-t border-black/5 pt-5 pb-10">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Notifica collaboratori specifici</label>
              <p className="text-xs text-black/40 mb-3">Seleziona dipendenti specifici da avvisare sempre all'invio del modulo.</p>
              <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 max-h-48 overflow-y-auto p-3.5 border border-black/5 bg-[#FBF7F9] rounded-2xl">
                {users.map((u) => {
                  const selected = notifyUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleNotifyUser(u.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs transition hover:bg-black/5",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758] font-bold" 
                          : "bg-white border-black/5 text-black/75"
                      )}
                    >
                      <div className={cn(
                        "grid size-4 place-items-center rounded border transition",
                        selected ? "bg-[#A74758] border-[#A74758] text-white" : "border-black/20"
                      )}>
                        {selected && <Check className="size-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{u.name}</p>
                        {u.mansione && <p className="text-[10px] text-black/45 truncate mt-0.5">{u.mansione}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STAFF INTERACTIVE PREVIEW */}
        {activeTab === "preview" && (
          <div className="h-full flex flex-col items-center bg-[#FAF8FA] p-6 relative overflow-y-auto">
            {/* Device selector */}
            <div className="flex gap-2 rounded-xl bg-black/5 p-1 mb-5">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                  previewDevice === "desktop" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                )}
              >
                <Monitor className="size-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                  previewDevice === "mobile" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                )}
              >
                <Smartphone className="size-3.5" />
                Cellulare
              </button>
            </div>

            {/* Interactive container */}
            <div 
              className={cn(
                "bg-neutral-900 rounded-[28px] border border-white/10 text-white shadow-2xl p-6 transition-all duration-300 w-full flex flex-col",
                previewDevice === "mobile" ? "max-w-sm aspect-[9/16] min-h-[580px]" : "max-w-2xl min-h-[400px]"
              )}
            >
              {/* Header inside device */}
              <div className="border-b border-white/10 pb-4 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  {formCategory || "Generale"}
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <DynamicIcon name={formIcon} className="size-5 shrink-0" />
                  {formName || "Modulo senza titolo"}
                </h3>
                {formDesc && (
                  <p className="mt-2 text-xs text-white/50 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/5">
                    {formDesc}
                  </p>
                )}
              </div>

              {/* Progress Bar (no "Step" text) */}
              {visiblePreviewFields.length > 0 && (
                <div className="w-full bg-white/5 h-1 mb-5 relative overflow-hidden rounded-full">
                  <div 
                    className="h-full bg-gradient-to-r from-[#A74758] to-[#ff6b8b] transition-all duration-300 ease-out" 
                    style={{ width: `${Math.round(((Math.min(activePreviewFieldIndex, visiblePreviewFields.length - 1) + 1) / visiblePreviewFields.length) * 100)}%` }}
                  />
                </div>
              )}

              {/* Dynamic form preview rendering */}
              <div className="flex-1 space-y-5 overflow-y-auto pr-1">
                {(() => {
                  const currentIdx = Math.min(activePreviewFieldIndex, Math.max(0, visiblePreviewFields.length - 1));
                  const field = visiblePreviewFields[currentIdx];
                  if (!field) return <div className="text-center text-white/40 text-xs py-8">Nessuna domanda definita.</div>;
                  
                  return (
                    <div key={field.id} className="space-y-3.5 animate-in fade-in slide-in-from-right-5 duration-300">
                      <div className="space-y-1.5">
                        <label className="text-base font-extrabold text-white block leading-snug">
                          {field.label || `Domanda ${currentIdx + 1}`} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.description && (
                          <p className="text-xs text-white/60 leading-relaxed">{field.description}</p>
                        )}
                      </div>

                      <div className="pt-2">
                        {field.type === "text" && (
                          <input
                            type="text"
                            value={previewAnswers[field.id] || ""}
                            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handlePreviewNext();
                              }
                            }}
                            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-[#A74758]"
                          />
                        )}

                        {field.type === "textarea" && (
                          <textarea
                            rows={3}
                            value={previewAnswers[field.id] || ""}
                            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                            className="w-full rounded-xl bg-white/5 border border-white/10 p-3.5 text-sm text-white outline-none focus:border-[#A74758] resize-none"
                          />
                        )}

                        {field.type === "number" && (
                          <input
                            type="number"
                            value={previewAnswers[field.id] || ""}
                            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handlePreviewNext();
                              }
                            }}
                            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-[#A74758]"
                          />
                        )}

                        {field.type === "select" && (
                          <div className="space-y-2.5 w-full">
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                              {field.options?.map((opt: string) => {
                                const isSelected = previewAnswers[field.id] === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      setPreviewAnswers(prev => ({ ...prev, [field.id]: opt }));
                                      if (opt && opt !== "Altro") {
                                        setTimeout(() => {
                                          setActivePreviewFieldIndex(prev => {
                                            if (prev < visiblePreviewFields.length - 1) return prev + 1;
                                            return prev;
                                          });
                                        }, 350);
                                      }
                                    }}
                                    className={cn(
                                      "w-full p-4 rounded-2xl border text-left text-sm font-semibold transition-all duration-200 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99]",
                                      isSelected
                                        ? "bg-[#A74758]/20 border-[#A74758] text-[#ff8bb2] shadow-md shadow-[#A74758]/10"
                                        : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
                                    )}
                                  >
                                    <span>{opt}</span>
                                    <div className={cn(
                                      "size-5 rounded-full border flex items-center justify-center transition-all",
                                      isSelected 
                                        ? "border-[#ff8bb2] bg-[#ff8bb2]/20 text-[#ff8bb2]" 
                                        : "border-white/20 bg-white/5"
                                    )}>
                                      {isSelected && <Check className="size-3" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            {previewAnswers[field.id] === "Altro" && (
                              <input
                                type="text"
                                placeholder="Specifica..."
                                value={previewAnswers[field.id + "_altro"] || ""}
                                onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id + "_altro"]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handlePreviewNext();
                                  }
                                }}
                                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-[#A74758] mt-2"
                              />
                            )}
                          </div>
                        )}

                        {field.type === "money" && (
                          <div className="relative flex items-center">
                            <span className="absolute left-4 text-sm font-semibold text-white/45">€</span>
                            <input
                              type="number"
                              step="0.01"
                              value={previewAnswers[field.id] || ""}
                              onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handlePreviewNext();
                                }
                              }}
                              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-8 pr-4 text-sm text-white outline-none focus:border-[#A74758]"
                              placeholder="0.00"
                            />
                          </div>
                        )}

                        {field.type === "date" && (
                          <input
                            type="date"
                            value={previewAnswers[field.id] || ""}
                            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handlePreviewNext();
                              }
                            }}
                            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-[#A74758]"
                          />
                        )}

                        {field.type === "worker" && (
                          <select
                            value={previewAnswers[field.id] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPreviewAnswers(prev => ({ ...prev, [field.id]: val }));
                              if (val) {
                                setTimeout(() => {
                                  setActivePreviewFieldIndex(prev => {
                                    if (prev < visiblePreviewFields.length - 1) return prev + 1;
                                    return prev;
                                  });
                                }, 350);
                              }
                            }}
                            className="w-full h-11 rounded-xl bg-neutral-800 border border-white/10 px-3 text-sm text-white outline-none focus:border-[#A74758]"
                          >
                            <option value="">Seleziona collaboratore...</option>
                            {users.map(u => (
                              <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                          </select>
                        )}

                        {field.type === "worker_multi" && (
                          <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
                            {users.map((u) => {
                              const selected = Array.isArray(previewAnswers[field.id]) && previewAnswers[field.id].includes(u.name);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setPreviewAnswers((prev) => {
                                      const current = Array.isArray(prev[field.id]) ? prev[field.id] as string[] : [];
                                      return {
                                        ...prev,
                                        [field.id]: current.includes(u.name) ? current.filter((name) => name !== u.name) : [...current, u.name],
                                      };
                                    });
                                  }}
                                  className={cn(
                                    "rounded-xl border px-3 py-2 text-left text-xs font-bold transition",
                                    selected ? "border-[#ff8bb2] bg-[#A74758]/25 text-[#ffb7cf]" : "border-white/10 bg-white/5 text-white/75"
                                  )}
                                >
                                  {u.name}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {field.type === "checkbox" && (
                          <button
                            type="button"
                            onClick={() => setPreviewAnswers((prev) => ({ ...prev, [field.id]: prev[field.id] !== true }))}
                            className={cn(
                              "flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-bold transition",
                              previewAnswers[field.id] === true ? "border-emerald-300 bg-emerald-500/20 text-emerald-100" : "border-white/10 bg-white/5 text-white/75"
                            )}
                          >
                            <span>{field.description || field.label}</span>
                            <span>{previewAnswers[field.id] === true ? "OK" : ""}</span>
                          </button>
                        )}

                        {field.type === "pin" && (
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={previewAnswers[field.id] || ""}
                            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handlePreviewNext();
                              }
                            }}
                            placeholder="PIN personale"
                            className="h-11 w-full rounded-xl border border-white/10 bg-neutral-800 px-4 text-center text-lg font-black tracking-[0.3em] text-white outline-none focus:border-[#A74758]"
                          />
                        )}

                        {field.type === "file" && (
                          <div className="rounded-xl border border-dashed border-white/20 p-5 text-center bg-white/5">
                            <p className="text-xs text-white/60">Simula caricamento file (.png, .pdf...)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bottom buttons inside device preview */}
              <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between">
                <div>
                  {activePreviewFieldIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivePreviewFieldIndex(prev => prev - 1)}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/10"
                    >
                      Indietro
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {activePreviewFieldIndex < visiblePreviewFields.length - 1 ? (
                    <button
                      type="button"
                      onClick={handlePreviewNext}
                      className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#A74758] px-4 text-xs font-bold text-white transition hover:scale-[1.02]"
                    >
                      Continua <ChevronRight className="size-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alert("Simulazione invio completata! I dati sono corretti.")}
                      className="inline-flex h-9 items-center rounded-xl bg-[#A74758] px-4 text-xs font-bold text-white transition hover:scale-[1.02]"
                    >
                      Simula Invio
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
