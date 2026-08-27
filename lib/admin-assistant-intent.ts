export type TeamStatusScope = "IN_TURNO" | "IN_PAUSA" | "USCITO" | "NON_ENTRATO";

type ConversationMessage = { role: "user" | "assistant"; content: string };

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
  if (
    /controll[oi] client|sched[ae] client/.test(normalized)
    || /(?:quant[ei]|qual[ei]|chi|cosa|quanto).{0,60}client[ei]/.test(normalized)
    || /quant[ei].{0,30}persone.{0,60}(?:servit|seguit)/.test(normalized)
    || /client[ei].{0,60}(?:ha fatto|servit|seguit|lavorat|incass|pagat|serviz|ordine)/.test(normalized)
    || /(?:ha fatto|servit|seguit).{0,40}client[ei]/.test(normalized)
  ) return "search_client_controls";
  if (requestedRequestType(text)) return "get_requests_overview";
  if (/fattur/.test(normalized)) return "get_invoice_status";
  if (/contratt|prorog|rinnov|cedolin|bust[ae] pag|\bcud\b|certificazione unica/.test(normalized)) return "get_document_status";
  return null;
}
