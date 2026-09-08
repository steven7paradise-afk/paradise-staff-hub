export const DOCUMENT_TYPES = [
  "CONTRATTO",
  "RINNOVO",
  "PROROGA",
  "BUSTA_PAGA",
  "CUD",
  "LETTERA_CONTESTAZIONE",
  "DOCUMENTO",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const DOCUMENT_TYPE_SET = new Set<string>(DOCUMENT_TYPES);

export function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPE_SET.has(value);
}

export type EmployeeDocumentGroup =
  | "CONTRATTI_RINNOVI"
  | "BUSTA_PAGA"
  | "CUD"
  | "LETTERE_CONTESTAZIONE"
  | "ALTRO";

export function employeeDocumentGroup(type: string, title: string): EmployeeDocumentGroup {
  const normalizedType = type.trim().toUpperCase();
  if (normalizedType === "LETTERA_CONTESTAZIONE") return "LETTERE_CONTESTAZIONE";
  if (["CONTRATTO", "RINNOVO", "PROROGA"].includes(normalizedType)) return "CONTRATTI_RINNOVI";
  if (normalizedType === "BUSTA_PAGA") return "BUSTA_PAGA";
  if (normalizedType === "CUD") return "CUD";

  // Compatibilita con documenti storici classificati soltanto tramite il titolo.
  const text = `${type} ${title}`.toLowerCase();
  if (/lettera di contestazione|contestazione disciplinare|richiamo disciplinare/.test(text)) return "LETTERE_CONTESTAZIONE";
  if (/contratto|rinnovo|proroga/.test(text)) return "CONTRATTI_RINNOVI";
  if (/busta.?paga|cedolino/.test(text)) return "BUSTA_PAGA";
  if (/\bcud\b|certificazione unica|\bcu\b/.test(text)) return "CUD";
  return "ALTRO";
}
