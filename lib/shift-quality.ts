export const QUALITY_CAUSES = ["Lavoro imputabile", "Richiesta della cliente", "Problema del prodotto", "Normale usura"] as const;
export type QualityCase = { id: string; rowId: string; version: string; client: string; time: string; order: string; previous: string; previousDate: string; performer: string; cause: string; note: string; confirmed: boolean; saved: boolean };
export function hasReworkService(answers: Record<string, unknown>) {
  const sections = Array.isArray(answers.worker_service_sections) ? answers.worker_service_sections as Record<string, unknown>[] : [];
  return /\bsistemazione\s+fasc(?:e|ie|ia)\b/i.test([answers.custom_services, answers.client_control_service_title, ...sections.map(s => s.services)].flat(3).filter(Boolean).join(" "));
}
export function qualityAffectsPreviousBonus(values: Record<string, unknown>, reviewedAt?: string | null) {
  return values.__qualityManaged !== "true" || Boolean(reviewedAt && values.__qualityConfirmed === "true" && values.__qualityCause === "Lavoro imputabile");
}

export function applyQualityAttribution(values: Record<string, unknown>, previousColumn: string, cause: string) {
  if (!(QUALITY_CAUSES as readonly string[]).includes(cause)) return;
  const previous = values[previousColumn];
  if (typeof previous === "string" && previous && previous !== "Staff Paradise") values.__qualityOriginalPrevious = previous;
  values[previousColumn] = cause === "Lavoro imputabile"
    ? (typeof values.__qualityOriginalPrevious === "string" ? values.__qualityOriginalPrevious : "Da verificare")
    : "Staff Paradise";
  values.__previousStaffManual = "true";
}
