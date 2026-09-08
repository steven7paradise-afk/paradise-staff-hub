export const DEFAULT_PAGE_OPTIONS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/hub", label: "Paradise Hub" },
  { path: "/my-shifts", label: "I miei turni" },
  { path: "/responsabile-di-turno", label: "Responsabile di turno" },
  { path: "/programmazione-responsabile-di-turno", label: "Programmazione responsabili" },
  { path: "/tasks", label: "Task" },
  { path: "/notifications", label: "Comunicazioni" },
  { path: "/email", label: "Email" },
  { path: "/schedules", label: "Planning" },
  { path: "/social-calendar", label: "Programmazione social" },
  { path: "/orders", label: "Ordini" },
  { path: "/shopify-orders", label: "Ordini Shopify" },
  { path: "/shipping", label: "Spedizioni" },
  { path: "/appointments", label: "Appuntamenti" },
  { path: "/consulenza-online", label: "Consulenza online" },
  { path: "/cash", label: "Cassa" },
  { path: "/cassa-live", label: "Cassa live" },
  { path: "/invoices", label: "Fatture" },
  { path: "/refunds", label: "Rimborsi" },
  { path: "/client-control", label: "Controllo cliente" },
  { path: "/fine-giornata", label: "Fine giornata" },
  { path: "/tables", label: "Magazzino Paradise" },
  { path: "/points", label: "Punti" },
  { path: "/staff", label: "Staff Paradise" },
  { path: "/employees", label: "Dipendenti" },
  { path: "/recruitment", label: "Recruitment" },
  { path: "/attendance", label: "Timbrature" },
  { path: "/work-hours", label: "Ore staff" },
  { path: "/requests", label: "Ferie e permessi" },
  { path: "/documents", label: "Documenti" },
  { path: "/cedolini", label: "Cedolini" },
  { path: "/malattie", label: "Malattie" },
  { path: "/team", label: "Team" },
  { path: "/service-forms", label: "Moduli operativi" },
  { path: "/service-notes", label: "Note servizi" },
  { path: "/profile", label: "Profilo" },
] as const;

export type DefaultPagePath = (typeof DEFAULT_PAGE_OPTIONS)[number]["path"];

const defaultPagePaths = new Set<string>(DEFAULT_PAGE_OPTIONS.map((option) => option.path));

export function isDefaultPagePath(value: unknown): value is DefaultPagePath {
  return typeof value === "string" && defaultPagePaths.has(value);
}

export function normalizeDefaultPage(value: unknown): DefaultPagePath | null {
  const path = typeof value === "string" ? value.trim() : "";
  return isDefaultPagePath(path) ? path : null;
}
