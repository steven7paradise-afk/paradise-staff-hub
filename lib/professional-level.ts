import { asRecord } from "./former-employee";

export const PROFESSIONAL_LEVELS = ["Master", "Autonomo", "Junior"] as const;
export type ProfessionalLevel = typeof PROFESSIONAL_LEVELS[number] | "";

export function readProfessionalLevel(workforceData: unknown): ProfessionalLevel {
  const value = asRecord(workforceData).professionalLevel;
  return PROFESSIONAL_LEVELS.includes(value as typeof PROFESSIONAL_LEVELS[number])
    ? value as ProfessionalLevel : "";
}

/** Merge only this field so contract and other workforce details remain intact. */
export function withProfessionalLevel(workforceData: unknown, value: unknown) {
  const result = { ...asRecord(workforceData) };
  if (value === undefined) return result;
  if (value === null || value === "") {
    delete result.professionalLevel;
    return result;
  }
  if (!PROFESSIONAL_LEVELS.includes(value as typeof PROFESSIONAL_LEVELS[number])) {
    throw new Error("Livello professionale non valido. Scegli Master, Autonomo o Junior.");
  }
  result.professionalLevel = value;
  return result;
}
