export type TeamStatusScope = "IN_TURNO" | "IN_PAUSA" | "USCITO" | "NON_ENTRATO";

type ConversationMessage = { role: "user" | "assistant"; content: string };

export function verifiedClientAppointmentStatus(localStatus: unknown, rawAttendance: unknown, confirmationStatus: unknown) {
  const local = String(localStatus || "").trim().toUpperCase();
  if (local) return local;
  const attendance = String(rawAttendance || "").trim();
  if (/NO[_\s-]?SHOW|NON[_\s-]?PRESENT/i.test(attendance)) return "NON_PRESENTATO";
  return String(confirmationStatus || "").trim() || "PRENOTATO";
}

export function taskChecklistProgress(value: unknown) {
  const items = Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
  const completed = items.filter((item) => item.done === true).length;
  return {
    total: items.length,
    completed,
    pending: Math.max(0, items.length - completed),
    percentage: items.length ? Math.round((completed / items.length) * 100) : null,
    items: items.map((item) => ({
      text: String(item.text || "").trim(),
      done: item.done === true,
      completedBy: typeof item.completedBy === "string" ? item.completedBy : null,
      completedAt: typeof item.completedAt === "string" ? item.completedAt : null,
    })).filter((item) => item.text),
  };
}

function statusMention(value: string): TeamStatusScope | null {
  const text = value.toLocaleLowerCase("it");
  if (/paus/.test(text)) return "IN_PAUSA";
  if (/assen|non (è |e )?ent|mancata timbratura/.test(text)) return "NON_ENTRATO";
  if (/uscit|fuori turno/.test(text)) return "USCITO";
  if (/in turno|al lavoro|lavorando/.test(text)) return "IN_TURNO";
  return null;
}

export function requestedTeamStatus(messages: ConversationMessage[]): TeamStatusScope | null {
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user" && message.content.trim());
  if (lastUserIndex < 0) return null;

  const direct = statusMention(messages[lastUserIndex].content);
  if (direct) return direct;

  const isContextualFollowUp = /^(chi|quali)(\s+(è|e|sono|sarebbero))?\s*\??$/i.test(messages[lastUserIndex].content.trim())
    || /^(fammi vedere|mostrameli|mostramele|dimmi i nomi|i nomi)\s*\??$/i.test(messages[lastUserIndex].content.trim());
  if (!isContextualFollowUp) return null;

  for (let index = lastUserIndex - 1; index >= 0; index -= 1) {
    const mentioned = statusMention(messages[index].content);
    if (mentioned) return mentioned;
  }
  return null;
}

export function requestedTaskStatus(text: string) {
  const normalized = text.toLocaleLowerCase("it");
  if (/complet|conclus|finit/.test(normalized)) return "COMPLETED";
  if (/scadut|in ritardo/.test(normalized)) return "OVERDUE";
  if (/in corso|attiv/.test(normalized)) return "ACTIVE";
  if (/in attesa|aspett/.test(normalized)) return "WAITING";
  if (/nuov/.test(normalized)) return "NEW";
  return null;
}

export type RequestOverviewType = "FERIE" | "PERMESSO" | "RIPOSO" | "MALATTIA" | "RITARDO";
export type ClientQuestionMode = "SCHEDULED" | "WORKED" | "COMPLETED" | "DETAILS";
export type ClientResponseType = "BRIEF" | "DATED" | "VISIT_RECAP" | "CLIENT_RECAP" | "TIMELINE" | "NOTES" | "DELAYS" | "DURATION" | "PAYMENTS" | "REPORTS" | "COMPARE" | "ALERT" | "NEXT_APPOINTMENT";

export function requestedClientQuestionMode(text: string): ClientQuestionMode {
  const normalized = text.toLocaleLowerCase("it");
  if (/completat|conclus|terminat/.test(normalized)) return "COMPLETED";
  if (/(?:ha|hanno|hai).{0,30}(?:fatto|lavorat|servit|seguit)|incass|client[ei] lavorat/.test(normalized)) return "WORKED";
  if (/ci sono|prenot|appuntament|in agenda|previs|in programma|devono venire|arrivano/.test(normalized)) return "SCHEDULED";
  return "DETAILS";
}

export function requestedClientResponseType(text: string): ClientResponseType {
  const normalized = text.toLocaleLowerCase("it");
  if (/confront|differenz.{0,30}(?:appuntament|visite|applicazion)/.test(normalized)) return "COMPARE";
  if (/timeline|tutta la storia|storico completo|in ordine cronologico/.test(normalized)) return "TIMELINE";
  if (/recap.{0,30}(?:ultima|visita|volta)|cosa (?:è|e) successo durante/.test(normalized)) return "VISIT_RECAP";
  if (/riepilogo completo|panoramica generale|cliente 360/.test(normalized)) return "CLIENT_RECAP";
  if (/cosa (?:devo|dobbiamo) sapere|prima che arriv|alert/.test(normalized)) return "ALERT";
  if (/prossim[oa].{0,30}appuntament|altri appuntamenti futuri/.test(normalized)) return "NEXT_APPOINTMENT";
  if (/note|indicazion/.test(normalized)) return "NOTES";
  if (/segnalazion|reclam|problema|sistemazion|fastidio|cadut[ao].{0,20}fascia/.test(normalized)) return "REPORTS";
  if (/pagat|pagamento|acconto|saldo|rate|credito|sconto|promozion/.test(normalized)) return "PAYMENTS";
  if (/durat|inizio.{0,20}servizio|fine.{0,20}servizio|tempo.{0,20}salone/.test(normalized)) return "DURATION";
  if (/ritard|puntual|anticipo|ora.{0,20}arriv/.test(normalized)) return "DELAYS";
  if (/ultima|precedente|quando/.test(normalized)) return "DATED";
  return "BRIEF";
}

export function requestedRequestType(text: string): RequestOverviewType | null {
  const normalized = text.toLocaleLowerCase("it");
  if (/ritard/.test(normalized)) return "RITARDO";
  if (/mal+at|mal+att/.test(normalized)) return "MALATTIA";
  if (/ferie|vacanz/.test(normalized)) return "FERIE";
  if (/riposo|riposi/.test(normalized)) return "RIPOSO";
  if (/permess/.test(normalized)) return "PERMESSO";
  return null;
}

export function requiredAssistantTool(text: string) {
  const normalized = text.toLocaleLowerCase("it");
  if (/\btask\b|compito|attività assegnata/.test(normalized)) return "get_task_overview";
  if (/controll[oi] client|sched[ae] client/.test(normalized)) return "search_client_controls";
  if (/\bordini?\b|numero ordine|ordine.{0,50}(?:assegn|complet|pront|compilat)|(?:assegn|complet|pront|compilat).{0,50}ordine/.test(normalized)) return "get_orders_overview";
  if (
    /(?:che|quale).{0,20}(?:mansione|ruolo|sede|reparto)/.test(normalized)
    || /dove lavora|fa parte(?: di)?|informazioni.{0,30}(?:lavoratore|dipendente)|scheda.{0,30}(?:lavoratore|dipendente)/.test(normalized)
  ) return "get_employee_profile";
  if (
    /(?:quant[ei]|qual[ei]|chi|cosa|quanto).{0,60}client[ei]/.test(normalized)
    || /chi (?:viene|verrà|verra|arriva).{0,30}(?:oggi|domani|in salone)|appuntament[oi].{0,30}(?:oggi|domani|ieri)/.test(normalized)
    || /quant[ei].{0,30}persone.{0,60}(?:servit|seguit)/.test(normalized)
    || /client[ei].{0,60}(?:ha fatto|servit|seguit|lavorat|incass|pagat|serviz|ordine)/.test(normalized)
    || /(?:ha fatto|servit|seguit).{0,40}client[ei]/.test(normalized)
    || /grammatura|\bgrammi\b|\bfasce\b|lunghezza.{0,20}(?:extension|capelli)|colore.{0,20}extension|riapplicazion|rimozion.{0,20}extension/.test(normalized)
    || /prima visita|ultima visita|prossimo appuntamento|timeline.{0,30}(?:cliente|visite)|recap.{0,30}(?:visita|ultima volta)/.test(normalized)
    || /foto.{0,30}(?:cliente|applicazione|servizio)|(?:cliente|applicazione).{0,30}foto/.test(normalized)
    || /segnalazion|sistemazion.{0,30}(?:fasce|cliente|applicazione)|garanzia.{0,30}(?:cliente|extension|applicazione)/.test(normalized)
  ) return "search_client_controls";
  if (requestedRequestType(text)) return "get_requests_overview";
  if (/fattur/.test(normalized)) return "get_invoice_status";
  if (/contratt|prorog|rinnov|cedolin|bust[ae] pag|\bcud\b|certificazione unica/.test(normalized)) return "get_document_status";
  return null;
}
