import { prisma } from "@/lib/prisma";

export const CASH_CLOSING_FORM_NAME = "Chiusura Cassa";
export const CASH_CLOSING_FORM_CATEGORY = "Cassa";

export const CASH_CLOSING_FIELD_IDS = {
  date: "cash_date",
  withdrawn: "cash_withdrawn",
  fund: "cash_fund",
  notes: "cash_notes",
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
    label: "ORDINI RICEVUTI IN CONTANTI",
    type: "money",
    required: true,
    description: "Inserisci manualmente il totale degli ordini pagati in contanti. Il fondo cassa va indicato nel passaggio successivo e non deve essere incluso.",
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
    const expectedRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
    const expectedNotifyRoles = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
    const alreadyReady =
      existing.category === CASH_CLOSING_FORM_CATEGORY &&
      existing.active &&
      JSON.stringify(roles ?? []) === JSON.stringify(expectedRoles) &&
      JSON.stringify(notifyRoles ?? []) === JSON.stringify(expectedNotifyRoles) &&
      JSON.stringify(existing.fields ?? []) === JSON.stringify(CASH_CLOSING_FORM_FIELDS);

    if (alreadyReady) return existing;

    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        category: CASH_CLOSING_FORM_CATEGORY,
        description: "Chiusura automatica Contanti con confronto tra Controllo Cliente e Shopify.",
        icon: existing.icon || "Calculator",
        active: true,
        allowed_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
        notify_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
        fields: CASH_CLOSING_FORM_FIELDS,
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: CASH_CLOSING_FORM_NAME,
      description: "Chiusura automatica Contanti con confronto tra Controllo Cliente e Shopify.",
      category: CASH_CLOSING_FORM_CATEGORY,
      icon: "Calculator",
      active: true,
      allowed_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      fields: CASH_CLOSING_FORM_FIELDS,
      created_by_id: createdById ?? null,
    },
  });
}
