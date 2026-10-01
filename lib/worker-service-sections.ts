import { appointmentStaffDisplayName } from "./appointment-staff-access";
import { CLIENT_CONTROL_SERVICE_OPTIONS, SECONDARY_SERVICE_OPTIONS } from "./client-control-service-rules";
import { clientControlServiceSentence } from "./client-control-summary";

const ALLOWED_WORKER_SERVICES: readonly string[] = [...new Set([...CLIENT_CONTROL_SERVICE_OPTIONS, ...SECONDARY_SERVICE_OPTIONS])];

export type WorkerServiceSection = {
  staffId: string;
  slot?: "additional";
  services: string[];
  grammi: string;
  lunghezza: string;
  fasce: string;
  atteggiamento: string;
  details: string[];
  draftDetail: string;
};

export function emptyWorkerService(staffId: string): WorkerServiceSection {
  return { staffId, services: [], grammi: "", lunghezza: "", fasce: "", atteggiamento: "", details: [], draftDetail: "" };
}

export function workerServiceKey(section: WorkerServiceSection) {
  return JSON.stringify([section.staffId, section.slot || "main"]);
}

/** Keep notes attached to their author, with two independent sections for solo work. */
export function reconcileWorkerServices(sections: WorkerServiceSection[], staffIds: string[]) {
  const result = [...new Set(staffIds)].flatMap(id => {
    const own = sections.filter(section => section.staffId === id);
    const main = own.find(section => !section.slot) || emptyWorkerService(id);
    const additional = own.filter(section => section.slot);
    return [main, ...additional.filter(section => staffIds.length === 1 || Boolean(workerServiceNote(section) || section.draftDetail.trim()))];
  });
  if (result.length === 1) result.push({ ...emptyWorkerService(result[0].staffId), slot: "additional" });
  return result;
}

export function orderedServiceStaff(ids: string[], primaryId?: string) {
  const unique = [...new Set(ids)];
  return primaryId && unique.includes(primaryId) ? [primaryId, ...unique.filter(id => id !== primaryId)] : unique;
}

/** Assignment audit lines are metadata, not details written about the service. */
export function cleanWorkerServiceDetail(value: string) {
  return value.trim().replace(/(^|[.\n]\s*)Staff:\s*[^.\n]+\.?/gi, "$1")
    .replace(/Collaboratric[ei] assegnat[ae] da Paradise Staff Hub:\s*[^.\n]+\.?/gi, "")
    .replace(/^\s*\.\s*/, "").trim();
}

function workerServiceReceiptBody(section: WorkerServiceSection) {
  const details = section.details.map(cleanWorkerServiceDetail).filter(Boolean);
  const specs = [["Grammi", section.grammi], ["Lunghezza", section.lunghezza], ["Fasce", section.fasce], ["Cliente", section.atteggiamento]].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
  return [
    ...(details.length ? ["-----------------------", "NOTA", details.join("\n")] : []),
    ...(section.services.length ? ["-----------------------", "SERVIZI ESEGUITI", section.services.join("\n")] : []),
    ...(specs.length ? ["-----------------------", ...specs] : []),
  ].join("\n");
}

function workerServiceReceiptHeader(staffId: string, name: string, serviceDate?: string) {
  const date = serviceDate && Number.isFinite(Date.parse(serviceDate)) ? new Date(serviceDate) : new Date();
  const dateLabel = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" }).format(date);
  return `${appointmentStaffDisplayName(name, staffId)}..............${dateLabel}`;
}

export function workerServiceReceipt(section: WorkerServiceSection, name: string, serviceDate?: string) {
  return [workerServiceReceiptHeader(section.staffId, name, serviceDate), workerServiceReceiptBody(section)].filter(Boolean).join("\n");
}

export function workerServiceNote(section: WorkerServiceSection) {
  return clientControlServiceSentence({ ...section, extraNote: section.details.map(cleanWorkerServiceDetail).filter(Boolean).join("\n") });
}

export function combinedWorkerServiceNote(sections: WorkerServiceSection[], staff: { id: string; name: string }[], serviceDate?: string) {
  const groups = new Map<string, WorkerServiceSection[]>();
  for (const section of sections) {
    if (!workerServiceReceiptBody(section)) continue;
    const group = groups.get(section.staffId) || [];
    group.push(section);
    groups.set(section.staffId, group);
  }
  return [...groups].map(([id, ownSections]) => [
    workerServiceReceiptHeader(id, staff.find(person => person.id === id)?.name || "Collaboratrice", serviceDate),
    ...ownSections.map(workerServiceReceiptBody),
  ].join("\n")).join("\n\n");
}

/** IDs, services and bounds are verified on the server before writing any draft. */
export function parseWorkerServices(value: unknown, staffIds: string[]): WorkerServiceSection[] {
  if (!Array.isArray(value) || value.length < staffIds.length || value.length > 40) throw new Error("Le sezioni dei servizi devono corrispondere alle collaboratrici selezionate.");
  const seen = new Set<string>();
  const parsed = value.map(raw => {
    if (!raw || typeof raw !== "object") throw new Error("Sezione servizio non valida.");
    const item = raw as Record<string, unknown>;
    if (typeof item.staffId !== "string" || !staffIds.includes(item.staffId)) throw new Error("Collaboratrice del servizio non valida.");
    if (item.slot !== undefined && item.slot !== "additional") throw new Error("Sezione servizio non valida.");
    const identity = JSON.stringify([item.staffId, item.slot || "main"]);
    if (seen.has(identity)) throw new Error("Sezione servizio duplicata.");
    seen.add(identity);
    const text = (key: string, max = 100) => {
      if (typeof item[key] !== "string" || (item[key] as string).length > max) throw new Error("Dettagli del servizio non validi o troppo lunghi.");
      return (item[key] as string).trim();
    };
    if (!Array.isArray(item.services) || item.services.length > ALLOWED_WORKER_SERVICES.length || item.services.some(service => !ALLOWED_WORKER_SERVICES.includes(service as string))) throw new Error("Servizio non valido.");
    if (!Array.isArray(item.details) || item.details.length > 30 || item.details.some(detail => typeof detail !== "string" || detail.length > 6000)) throw new Error("Nota del servizio non valida o troppo lunga.");
    return { staffId: item.staffId, ...(item.slot === "additional" ? { slot: "additional" as const } : {}), services: [...new Set(item.services as string[])], grammi: text("grammi"), lunghezza: text("lunghezza"), fasce: text("fasce"), atteggiamento: text("atteggiamento"), details: (item.details as string[]).map(cleanWorkerServiceDetail).filter(Boolean), draftDetail: text("draftDetail", 600) };
  });
  if (staffIds.some(id => !parsed.some(section => section.staffId === id && !section.slot))) throw new Error("Manca la sezione di una collaboratrice.");
  return parsed;
}

export function removeOfficeNoteFromLegacy(note: string, officeNote: string) {
  if (!officeNote.trim()) return note.trim();
  return note.split(officeNote.trim()).join("").replace(/(?:Nota ufficio|Note):\s*(?=$|[•\n])/gi, "").replace(/^[\s•.]+|[\s•.]+$/g, "").trim();
}

export function restoreWorkerServices(
  answers: Record<string, unknown> | undefined,
  staffIds: string[],
  officeNote: string,
  fallback: Omit<WorkerServiceSection, "staffId" | "draftDetail" | "details">,
) {
  if (!staffIds.length) return [];
  if (Array.isArray(answers?.worker_service_sections)) {
    const stored = answers.worker_service_sections as WorkerServiceSection[];
    // Validate against the stored identities; a changed team gets blank sections for new members.
    try {
      const valid = parseWorkerServices(stored, [...new Set(stored.map(item => item.staffId))]);
      return reconcileWorkerServices(valid, staffIds);
    } catch { /* Preserve legacy text below for older or incomplete drafts. */ }
  }
  const extra = cleanWorkerServiceDetail(removeOfficeNoteFromLegacy(String(answers?.custom_extra_note || ""), officeNote));
  const previous = cleanWorkerServiceDetail(removeOfficeNoteFromLegacy(String(answers?.client_control_notes_text || ""), officeNote)
    .replace(/^Sezione \d+ — [^\n]*?:\s*/gm, "")
    .replace(/(^|\n)Servizi:\s*[^.\n]+\.?/gi, "$1"));
  const services = Array.isArray(answers?.custom_services)
    ? (answers.custom_services as unknown[]).filter((service): service is string => typeof service === "string" && ALLOWED_WORKER_SERVICES.includes(service as string))
    : fallback.services;
  const primary = { ...emptyWorkerService(staffIds[0]), ...fallback, services,
    grammi: String(answers?.custom_grammi ?? fallback.grammi), lunghezza: String(answers?.custom_lunghezza ?? fallback.lunghezza),
    fasce: String(answers?.custom_fasce ?? fallback.fasce), atteggiamento: String(answers?.custom_atteggiamento ?? fallback.atteggiamento),
    details: extra ? [extra] : previous ? [previous] : [],
  };
  return reconcileWorkerServices([primary], staffIds);
}
