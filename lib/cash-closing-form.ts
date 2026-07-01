import { prisma } from "@/lib/prisma";

export const CASH_CLOSING_FORM_NAME = "Chiusura Cassa";
export const CASH_CLOSING_FORM_CATEGORY = "Cassa";

export const CASH_CLOSING_FIELD_IDS = {
  date: "cash_date",
  withdrawn: "cash_withdrawn",
  fund: "cash_fund",
  notes: "cash_notes",
  pin: "cash_signature_pin",
} as const;

export const CASH_CLOSING_FORM_FIELDS = [
  {
    id: CASH_CLOSING_FIELD_IDS.date,
    label: "DATA ODIERNA",
    type: "date",
    required: true,
    description: "Data relativa alla chiusura fiscale.",
  },
  {
    id: CASH_CLOSING_FIELD_IDS.withdrawn,
    label: "IMPORTO PRELEVATO",
    type: "money",
    required: true,
    description: "Inserisci la cifra esatta che stai rimuovendo dalla cassa senza tenere in considerazione il fondo cassa.",
  },
  {
    id: CASH_CLOSING_FIELD_IDS.fund,
    label: "FONDO CASSA",
    type: "money",
    required: true,
    description: "Se l'importo e diverso da € 50,00, giustifica la differenza nelle note.",
  },
  {
    id: CASH_CLOSING_FIELD_IDS.notes,
    label: "NOTE",
    type: "textarea",
    required: false,
    description: "Utilizza questo spazio per segnalare eventuali discrepanze, errori o problemi.",
  },
  {
    id: CASH_CLOSING_FIELD_IDS.pin,
    label: "PIN PERSONALE",
    type: "pin",
    required: true,
    description: "Inserisci il tuo PIN personale per firmare la chiusura cassa.",
  },
];

export function isCashClosingFormName(name?: string | null, category?: string | null) {
  const text = `${name ?? ""} ${category ?? ""}`.toUpperCase();
  return text.includes("CHIUSURA CASSA") || text.includes("CASSA");
}

export async function ensureCashClosingForm(createdById?: string | null) {
  const existing = await prisma.serviceForm.findFirst({
    where: {
      OR: [
        { name: CASH_CLOSING_FORM_NAME },
        { name: { contains: "chiusura cassa", mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "asc" },
  });

  if (existing) {
    const roles = existing.allowed_roles as string[] | null;
    const notifyRoles = existing.notify_roles as string[] | null;
    const expectedRoles = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
    const expectedNotifyRoles = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
    const alreadyReady =
      existing.category === CASH_CLOSING_FORM_CATEGORY &&
      existing.active &&
      JSON.stringify(roles ?? []) === JSON.stringify(expectedRoles) &&
      JSON.stringify(notifyRoles ?? []) === JSON.stringify(expectedNotifyRoles) &&
      Boolean(existing.fields);

    if (alreadyReady) return existing;

    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        category: CASH_CLOSING_FORM_CATEGORY,
        icon: existing.icon || "Calculator",
        active: true,
        allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
        notify_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
        fields: existing.fields || CASH_CLOSING_FORM_FIELDS,
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: CASH_CLOSING_FORM_NAME,
      description: "Modulo per registrare la chiusura fiscale giornaliera della cassa, con importo prelevato, fondo cassa, note e firma tramite PIN personale.",
      category: CASH_CLOSING_FORM_CATEGORY,
      icon: "Calculator",
      active: true,
      allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      fields: CASH_CLOSING_FORM_FIELDS,
      created_by_id: createdById ?? null,
    },
  });
}
