export const SIDEBAR_ICON_OPTIONS = [
  { name: "LayoutDashboard", label: "Dashboard" },
  { name: "Home", label: "Casa" },
  { name: "CalendarDays", label: "Calendario" },
  { name: "CalendarCheck", label: "Calendario verificato" },
  { name: "CheckSquare", label: "Attività" },
  { name: "ClipboardCheck", label: "Checklist" },
  { name: "ClipboardList", label: "Elenco" },
  { name: "Bell", label: "Notifiche" },
  { name: "Mail", label: "Email" },
  { name: "Users", label: "Persone" },
  { name: "UserRound", label: "Profilo" },
  { name: "UserPlus", label: "Nuova persona" },
  { name: "Building2", label: "Salone" },
  { name: "ShoppingCart", label: "Carrello" },
  { name: "Store", label: "Negozio" },
  { name: "Truck", label: "Spedizione" },
  { name: "Package", label: "Pacco" },
  { name: "DollarSign", label: "Denaro" },
  { name: "CashRegister", label: "Registratore" },
  { name: "ReceiptText", label: "Ricevuta" },
  { name: "Calculator", label: "Calcolatrice" },
  { name: "FileText", label: "Documento" },
  { name: "FileCheck2", label: "Documento verificato" },
  { name: "FilePenLine", label: "Documento da compilare" },
  { name: "Table2", label: "Tabella" },
  { name: "BarChart3", label: "Grafico" },
  { name: "TrendingUp", label: "Andamento" },
  { name: "Award", label: "Premio" },
  { name: "Star", label: "Stella" },
  { name: "Heart", label: "Cuore" },
  { name: "ShieldCheck", label: "Protezione" },
  { name: "Smartphone", label: "Telefono" },
  { name: "Video", label: "Video" },
  { name: "Share2", label: "Condivisione" },
  { name: "MapPin", label: "Posizione" },
  { name: "Folder", label: "Cartella" },
  { name: "PanelsTopLeft", label: "Pannello" },
  { name: "Settings", label: "Impostazioni" },
  { name: "Sparkles", label: "Novità" },
  { name: "Coffee", label: "Pausa" },
  { name: "AlertTriangle", label: "Avviso" },
  { name: "Activity", label: "Attività recente" },
  { name: "RotateCcw", label: "Rimborso" },
] as const;

export type SidebarIconName = (typeof SIDEBAR_ICON_OPTIONS)[number]["name"];

const sidebarIconNames = new Set<string>(SIDEBAR_ICON_OPTIONS.map((icon) => icon.name));

export function isSidebarIconName(value: unknown): value is SidebarIconName {
  return typeof value === "string" && sidebarIconNames.has(value);
}
